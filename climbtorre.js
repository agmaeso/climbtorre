var http = require('http'),
	fs = require('fs'),
	connect = require('connect'),
	express = require('express'),
	cluster = require('cluster'),  //solo lo necesito para preguntar si estoy en un worker y reportarlo
	vhost = require('vhost'),  // para tratar por ruta especifica el subdominio api.climbtorre
	bodyParser = require('body-parser'),
	session = require('express-session'),
	MongoStore = require('connect-mongo')(session), // almacena la session en mongoDB en vez de en memoria
	formidable = require('formidable'),  //librería para subir ficheros al servidor
	credentials = require('./credentials.js'),  //Passwords, secretos, credenciales...
	weather = require('./lib/weather.js'),
	emailService = require('./lib/email.js')(credentials),
	rockAvailableListener = require('./models/rockAvailableListener.js');

var app = express();

var entorno = app.get('env');
switch(entorno){
	case 'development':
		// compact, colorful dev logging
		app.use(require('morgan')('dev'));
		break;
	case 'production':
		// module 'express-logger' supports daily log rotation
		app.use(require('express-logger')({
		path: __dirname + '/log/requests.log'
		}));
		break;
}

//  TEMPORAL
//si estoy ejecutándome en un worker de un cluster (un proceso en cada core), repórtalo fyi
/*
app.use(function(req,res,next){
	if(entorno === 'development' && cluster.isWorker) 
		console.log('Worker %d ha recibido la request http', cluster.worker.id);
	next();
});
*/
app.use(express.static(__dirname + '/public'));

app.use(bodyParser.json());  // para poder leer los datos en json que me enviarán de formularios
app.use(bodyParser.urlencoded({extended: true})); // en este formato se codifican todos los strings dentro de los campos 

/////////////////////////////////////////////////////////////////
// Database
// 
var mongoose = require('mongoose'); 
var opts = {
	server: { 
		socketOptions: { keepAlive: 1 } 
	} 
};
switch(entorno) { 
	case 'development':
		mongoose.connect(credentials.mongo.development.connectionString, opts);
		break;
	case 'production':
		mongoose.connect(credentials.mongo.production.connectionString, opts);
		break; 
	default:
		throw new Error('Entorno de ejecución inadecuado: ' + entorno);
}

// When successfully connected
mongoose.connection.on('connected', function () {  
  console.log('Mongoose default connection open');
}); 

// If the connection throws an error
mongoose.connection.on('error',function (err) {  
  console.log('Mongoose default connection error: ' + err);
}); 

// When the connection is disconnected
mongoose.connection.on('disconnected', function () {  
  console.log('Mongoose default connection disconnected'); 
});

// If the Node process ends, close the Mongoose connection 
process.on('SIGINT', function() {  
  mongoose.connection.close(function () { 
    console.log('Mongoose default connection disconnected through app termination'); 
    process.exit(0); 
  }); 
}); 

var model_container = require('./models/rock.js');  //esquema Mongoose
var Rock = model_container[1];
var Line = model_container[0];
//var Rock = require('./models/rock.js');  //esquema Mongoose

/////////////////////////////////////////////////////////////////
//  Cookies y Sesiones
//
//app.use(require('cookie-parser')(credentials.cookieSecret)); // ya no es necesario con express-session >= 1.5.0
var sess = {
	name: 'climbtorre.sid',
	resave: true,  // false en producción??
	saveUninitialized: false,
	secret: credentials.cookieSecret,
	store: new MongoStore({ 
		mongooseConnection: mongoose.connection 
	}), //si no se pone esto la sesión se almacena en memoria
//	store: new MongoStore({ 
//		url: credentials.mongo.production.connectionString, 
//		autoreconnect: true
//	}), // he leido en algún sitio que a veces pierde la conexión compartida con mongoose y esto es el arreglo
	cookie: {}
};

if (entorno === 'production') {  // pasamos a modo https
  app.set('trust proxy', 1); // trust first proxy
  sess.cookie.secure = true; // serve secure cookies
};

app.use(require('express-session')(sess));

/////////////////////////////////////////////////////////////////
//  Defensa CSRF
//
app.use(require('csurf')());
app.use(function(req, res, next) {
	res.locals._csrfToken = req.csrfToken();
	next();
});



/////////////////////////////////////////////////////////////////
// Template view engine - Handlebars
// 
// 
var handlebars = require('express-handlebars').create({ 
		defaultLayout:'main',
 		helpers: {
			section: function(name, options){
 						if(!this._sections) this._sections = {};
 						this._sections[name] = options.fn(this);
 						return null;
 					},
 			static: function(name) {
						return require('./lib/static.js').map(name);

 					}
 		}
	});

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

/////////////////////////////////////////////////////////////////
// Css/Js bundling, for using in production
// 
var bundler = require('connect-bundle')(require('./config.js'));
app.use(bundler);


/////////////////////////////////////////////////////////////////
// Define Dominio de ejecución para manejar excepciones inesperadas
// 
app.use(function(req, res, next){
	// crea un dominio para esta request
	var domain = require('domain').create();
	// procesa los errores en este dominio
	domain.on('error', function(err){
		console.error('ERROR DE DOMINIO CAZADO\n', err.stack);
		try {
			// failsafe shutdown en 5 sg
			setTimeout(function(){
				console.error('Failsafe shutdown.');
				process.exit(1);  // ejecuta un shutdown ordenado
			}, 5000);
			// desconecta del cluster
			if(cluster.worker) worker.disconnect();
			// para de aceptar nuevas requests
			server.close();
			try {
				// intenta usar una ruta de error de Express
				next(err);
			} catch(err){
				// si falla la ruta de error de Express, intenta una respuesta Node directa
				console.error('Mecanismo de error de Express fallido.\n', err.stack);
				res.statusCode = 500;
				res.setHeader('content-type', 'text/plain');
				res.end('Error de servidor.');
			}
		} catch(err){
			console.error('No ha sido posible enviar una respuesta 500.\n', err.stack);
		}
	});
	// añade los objetos request y response al dominio
	domain.add(req);
	domain.add(res);
	// ejecuta el resto de la cadena request en el dominio
	domain.run(next);
});


/////////////////////////////////////////////////////////////////
// QA
// 
//Habilita los test (con la propiedad showTests) si fuera de producción aparece en la URL
//el parámetro ?test=1
app.use(function(req, res, next){
	res.locals.showTests = entorno !== 'production' && req.query.test === '1';
	next();
});

/////////////////////////////////////////////////////////////////
// funcionalidad específica de climbtorre
// 
//asegura que exixte directorio para almacenar imágenes uploaded
var dataDir = __dirname + '/data';
var vacationPhotoDir = dataDir + '/vacation-photo'; 
fs.existsSync(dataDir) || fs.mkdirSync(dataDir); 
fs.existsSync(vacationPhotoDir) || fs.mkdirSync(vacationPhotoDir);
function saveContestEntry(contestName, email, year, month, photoPath)
{
	// TODO...this will come later
};

// Mete el array con los dummy data de localizaciones y tiempo atmosférico
app.use(function(req, res, next){
	if(!res.locals.partials) res.locals.partials = {};
	res.locals.partials.weatherContext = weather.getWeatherData();
	next();
});

/////////////////////////////////////////////////////////////////
// mensajes flash
// 
app.use(function(req, res, next){
	// si hay un flash message, transfierelo al contexto, y después bórralo
	res.locals.flash = req.session.flash;
	delete req.session.flash;
	next();  // y por supuesto sigue con otro middleware
});

/////////////////////////////////////////////////////////////////
// CORS - cross-domain origin resource sharing
// 
//app.use('/api', require('cors')());
// solo doy acceso x-origin a mis APIs
// para uso avanzado ver la documentacion del paquete (cors)

/////////////////////////////////////////////////////////////////
// Rutas
// 
require('./routes.js')(app);

// TEMPORAL
// inicializa rocas
app.get('/initialize-database', function(req, res){

	Rock.find(function(err, rocks){

		if (err) {
			console.log('Error con base de datos: ' + err);
				res.statusCode = 500;
				res.setHeader('content-type', 'text/plain');
				res.end('Error de query.');
			return;
		}

	    if(rocks.length) {
	    	res.send('Ya estaba inicializada');
	    	return;  //si ya inicializado, termina
		}

		console.log('Inicializando Rocks en Mongodb');

		new Rock({
			name: 'Canto Limón',
			sku:'ZNB001',
			quality: 'Granito',
			description: 'Una roca monumental con varias vías de variada dificulta y zonas muy espaciosas alrededor',
			location: [-3.926,40.584],
			maturity: 'Consolidada',
			available: true,
			causeUnav: null,
			childs: [{
				name: 'A',
				category: '5-',
				length: 4.5,
				pitches: 1,
				condition: 'Bien equipada, granito con gran adherencia',
				description: 'Una via sencilla para aprendizaje de adherencia',
				duration: 15,
				materialRequired: 'Cuerda 20 mts',
				priceInCents: 300,
				tags: ['aprendizaje', 'adherencia', 'accesible', 'corta'],
				available: true,
				requiresWaiver: false,
				maximumGuests: 8,
				notes: 'Se suelen recorrer en la misma ruta todas las vías de esta cara oeste'
			},{
				name: 'B',
				category: '4+',
				length: 3.5,
				pitches: 1,
				condition: 'Bien equipada, buenos apoyos',
				description: 'Una via extra sencilla para quitarse el miedo y comenzar el aprendizaje de la escalada',
				duration: 15,
				materialRequired: 'Cuerda 20 mts',
				priceInCents: 200,
				tags: ['aprendizaje', 'sencilla', 'niños', 'accesible', 'corta'],
				available: true,
				requiresWaiver: false,
				maximumGuests: 8,
				notes: 'Unir a otras vías de esta roca para que los deportistas tengan buenos recuerdos'
			}]
		}).save(function(err) {
			if(err) {
				console.log('Error en la inicialización: '+err);
				res.statusCode = 500;
				res.setHeader('content-type', 'text/plain');
				res.end('Error de servidor.');
				return;
			} 
		});
		new Rock({
			name: 'Canto Garbanxo',
			sku:'ZNB002',
			quality: 'Granito',
			description: 'Una roca aislada sin equipación, de escalada tentadora y fácil aproximación.',
			location: [-3.921,40.583],
			maturity: 'Virgen',
			available: false,
			causeUnav: 'Peligro de desprendimientos.',
			childs: null
		}).save(function(err){
			if(err) {
				console.log('Error en la inicialización: '+err);
				res.statusCode = 500;
				res.setHeader('content-type', 'text/plain');
				res.end('Error de servidor.');
				return;
			} else {
				return res.send('INICIALIZACION de rocks en Mongodb completada');			
			}
		});
	});
});

app.get('/rocas', function(req, res){
    Rock.find({}).sort({ updated_at: -1 }).exec(function(err, rocks){  // find all
    	var currency = req.session.currency || '€';
        var context = {
            currency: currency,
            rocks: rocks.map(function(rock){
                return {
                    sku: rock.sku,
                    name: rock.name,
                    description: rock.description,
                    available: rock.available,
                    quality: rock.quality,
                    maturity: rock.maturity,
                    causeUnav: rock.causeUnav,
                    childs: rock.childs,
                };
            })
        };
	    if (rocks.length > 0) { 
	    	return res.render('rocks', context); 
	    } else { return res.redirect('500');}

    });
});

app.get('/areas/bouldering', function(req, res){
	res.render('areas/bouldering');
});

app.get('/areas/artificial', function(req, res){
	res.render('areas/artificial');
});

app.get('/areas/request-guide', function(req, res){
	res.render('areas/request-guide');
});

app.get('/contest/vacation-photo',function(req,res){
	var now = new Date();
	res.render('contest/vacation-photo', { year: now.getFullYear(), month: now.getMonth() });
});

app.post('/contest/vacation-photo/:year/:month', function(req, res){ 
	var form = new formidable.IncomingForm();
	form.parse(req, function(err, fields, files){
//		if(err) return res.redirect(303, '/error'); //no sobra esto??
		if(err) {
            res.session.flash = {
                type: 'danger',
                intro: 'Ufff!',
                message: 'Ha ocurrido un error procesando tu envío. ' +
                    'Por favor, inténtalo de nuevo.',
			};
			return res.redirect(303, '/contest/vacation-photo'); 
		}
		var photo = files.photo;
		var dir = vacationPhotoDir + '/' + Date.now(); 
		var path = dir + '/' + photo.name; 
		fs.mkdirSync(dir);  //probablemente sería bueno añadir verificación de que no exista ya aunque sea improbable
		fs.renameSync(photo.path, dir + '/' + photo.name); 
		saveContestEntry('vacation-photo', fields.email, req.params.year, req.params.month, path);
		req.session.flash = {
			type: 'success',
			intro: 'Genial!, Acabas de participar en el concurso.',
		};
		return res.redirect(303, '/contest/vacation-photo/entries'); 
	});
});

app.post('/newsletter', function(req, res){
	var name = req.body.name || '', email = req.body.email || '';
	//validación de los campos. Aunque se haga por el navegador tambien aqui para evitar spoofing
	if(!email.match(VALID_EMAIL_REGEX)) {
		if(req.xhr) return res.json({ error: 'Dirección de correo inválida.' });
		req.session.flash = {
			type: 'danger',
			intro: 'Error de validación',
			message: 'La dirección email entrada no es válida.',
		};
		return res.redirect(303, '/newsletter/archive');
	}
	new NewsletterSignup({ name: name, email: email }).save(function(err){
		if(err) {
			if(req.xhr) return res.json({ error: 'Error en la base de datos.' });
			req.session.flash = {
				type: 'danger',
				intro: 'Error en base de datos',
				message: 'Ha ocurrido en error en la base de datos; por favor, inténtelo más tarde.',
			}
			return res.redirect(303, '/newsletter/archive');
		}
		if(req.xhr) return res.json({ success: true });
		req.session.flash = {
			type: 'success',
			intro: '¡Gracias!',
			message: 'Te has registrado para recibir nuestra newsletter.',
		};
		return res.redirect(303, '/newsletter/archive');
	});
});

app.post('/process', function(req, res){
	console.log('Form (from querystring): ' + req.query.form);
	console.log('CSRF token (from hidden form field): ' + req.body._csrf);
	console.log('Name (from visible form field): ' + req.body.name);
	console.log('Email (from visible form field): ' + req.body.email);

	if(req.xhr || req.accepts('json,html')==='json'){
		// if there were an error, we would send { error: 'error description' }
		res.send({ success: true });  //devuelvo JSON
	} else {
		// este es el caso: en mi navegador primero veo html, luego xhtml+xml, luego xml y nada de json
		// if there were an error, we would redirect to an error page
		res.redirect(303, '/thank-you');
	}
});

//envía correo de confirmación de reserva de guía usando Nodemailer
app.post('/cart/checkout', function(req, res){
	var cart = req.session.cart;
	if(!cart) next(new Error('No existe el Carrito.'));
	var name = req.body.name || '', email = req.body.email || '';

	//validación de los campos. Aunque se haga por el navegador tambien aqui para evitar spoofing
	if(!email.match(VALID_EMAIL_REGEX)) 
		return res.next(new Error('Dirección email incorrecta.'));

	// asigna un ID aleatorio de carrito; lo normal sería el ID de una base de datos
	cart.number = Math.random().toString().replace(/^0\.0*/, '');
	cart.billing = {
		name: name,
		email: email,
	};

	//el primer render lleva una callback, no hay rendering en el navegador sino que se guarda 
	//en el parámetro html
	res.render('email/cart-thank-you', { layout: null, cart: cart }, function(err,html){
		if( err ) console.log('error en la plantilla del email');

		emailService.send(cart.billing.email, 
		'Gracias por reservar tu guía en la Escuela de Escalada Libre de Torrelodones', html);
	});	
	//este segundo render es el que va a la ventana del navegador
	res.render('cart-thank-you', { cart: cart });
});

app.get('/notify-me-when-available', function(req, res){
    res.render('notify-me-when-rock-becomes-available', { sku: req.query.sku });
});

app.post('/notify-me-when-available', function(req, res){
    rockAvailableListener.update(
        { email: req.body.email }, 
        { $push: { skus: req.body.sku } },  // añade valor a array
        { upsert: true }, // truco mongoose, si no existe lo inserta
	    function(err){
	        if(err) {
	        	console.error(err.stack);
	            req.session.flash = {
	                type: 'danger',
	                intro: 'Ufff!',
	                message: 'Error procesando tu solicitud de notificación.',
	            };
	            return res.redirect(303, '/rocas');
	        }
	        req.session.flash = {
	            type: 'success',
	            intro: 'Gracias!',
	            message: 'Te notificaremos cuando esta roca vuelva a poder ser escalada.',
	        };
	        return res.redirect(303, '/rocas');
	    }
	);
});

/////////////////////////////////////////////////////////////////
// API
//
var Activity = require('./models/activities.js');

// Uso connect-rest que da versatilidad al manejo de verbos HTTP y tiene algunas cosas interesantes
// si fuera a sofisticar esto.
var apiOptions = {
    context: '',
//    logger: { file:'conRest.log', level: 'verbose'},
    domain: { closeWorker: function(req, res){
		    		console.log('Error de dominio del API.\n');
    				setTimeout(function(){
	        			console.log('Parando el servidor tras error de dominio del API.');
    	    			process.exit(1);
    				}, 5000);
    				server.close();
    				var worker = require('cluster').worker;
    				if(worker) worker.disconnect();
				}	
			}
};

var rest = require('connect-rest').create(apiOptions);

// link API into pipeline
app.use(vhost('api.*', rest.processRequest()));

rest.get('/activities', function(req, content, cb){
    Activity.find({ approved: true }, function(err, activities){
        if(err) return cb(err);
        cb(null, activities.map(function(a){
            return {
                name: a.name,
                id: a._id,
                description: a.description,
                location: a.location,
            };
        }));
    });
});

rest.post('/activity', function(req, content, cb){
    var a = new Activity({
        name: req.body.name,
        description: req.body.description,
        location: [ req.body.lng, req.body.lat ],
        history: {
            event: 'created',
            email: req.body.email,
            date: new Date(),
        },
        approved: false,
    });
    a.save(function(err, a){
        if(err) return cb(err,'No se ha podido añadir la actividad.');
        cb(null, { id: a._id });
    }); 
});

rest.get('/activity/:id', function(req, content, cb){
    Activity.findById(req.params.id, function(err, a){
        if(err) return cb(err, 'No se ha podido encontrar la actividad.'); // termina en status 500 que no me gusta
        cb(null, { 
            name: a.name,
            id: a._id,
            description: a.description,
            location: a.location,
        });
    });
});

/////////////////////////////////////////////////////////////////
// Autorutas
//
var autoViews = {}; 

app.use(function(req,res,next){
	var path = req.path.toLowerCase();
	// mira en cache; si está, render  
	if(autoViews[path]) return res.render(autoViews[path]);
	// si no, buscamos a ver si hay en views una .handlebars que coincida
	if(fs.existsSync(__dirname + '/views' + path + '.handlebars'))
	{
		autoViews[path] = path.replace(/^\//, '');
		return res.render(autoViews[path]); 
	}   
	next(); 
});

//muestra los req.headers
//los de la response se pueden ver con las herrmientas para desarrolladores de Chrome
app.get('/headers', function(req,res){
	res.set('Content-Type','text/plain');
	var s = '';
	for(var name in req.headers) s += name + ': ' + req.headers[name] + '\n';
	res.send(s);
});

//prueba de secciones del libro
app.get('/jquery-test', function(req,res){
	res.render('book/jquery-test');
});
app.get('/nursery-rhyme', function(req, res){
	res.render('book/nursery-rhyme');
});
app.get('/data/nursery-rhyme', function(req, res){
	res.json({
		animal: 'squirrel',
		bodyPart: 'tail',
		adjective: 'bushy',
		noun: 'heck',
	});
});



// error route: custom 404 page
app.use(function(req, res){
	console.log(req.vhost);
	res.status(404);
	res.render('404');
});

// error route: custom 500 page
app.use(function(err, req, res, next){
	console.error(err.stack);
	res.status(500);
	res.render('500');
});


/////////////////////////////////////////////////////////////////
// Exporta función de arranque del servidor o arranca directamente
// 
// 
app.set('port', process.env.PORT || 4000);

function startServer() {
	http.createServer(app).listen(app.get('port'), function(){
		console.log( 'Express started in ' + entorno +
		' mode on http://localhost:' + app.get('port') +
		'; press Ctrl-C to terminate.' );
	});
}
if(require.main === module){
	// la aplicación ha sido ejecutada directamente con node climbtorre.js
	startServer();
} else {
	// la aplicación se ha importado como un module via "require": exporta la función
	// de crear server
	module.exports = startServer;
}