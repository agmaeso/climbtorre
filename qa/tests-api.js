var assert = require('chai').assert;
var http = require('http');
var rest = require('restler');

suite('API tests', function(){

    var activity = {
        lat: 40.583,
        lng: -3.927,
        name: 'Gymkana cumpleaños',
        description: 'Dirigida por monitores de tiempo libre - incluyendo algún Guía de la Escuela de Escalada - ' +
            'se ofrece a las familias la posibilidad de regalar una actividad inolvidable para la fiesta de ' +
            'cumpleaños de sus hijos. Edades: 7 a 14.',
        email: 'agmaeso@gmail.com',
    };

    var base = 'http://api.climbtorre:4000';

    test('debería poder agregar la actividad', function(done){
        rest.post(base+'/apix/activity', {data:activity})
			.on('success', function(data){
				assert.match(data.id, /\w/, 'id debe esta creado');
				done();
			})
			.on('error', function() {
				assert(false, '¿Recordaste crear el alias api.climbtorre a 127.0.0.1 en /etc/hosts?');
			});
	
    });

    test('debería poder obtener la actividad', function(done){
        rest.post(base+'/apix/activity', {data:activity}).on('success', function(data){
            rest.get(base+'/apix/activity/'+ data.id)
				.on('success', function(data){
					assert(data.name===activity.name);
					assert(data.description===activity.description);
					done();
				})
                .on('failure', function(){
                    console.log('Ha fallado algo en la recuperación...')
                })
				.on('error', function() {
					assert(false, '¿Recordaste crear el alias api.climbtorre a 127.0.0.1 en /etc/hosts?');
				});
        });
    });
    // Otros on('') disponibles; ver documentacion de Restler

});
