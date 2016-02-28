var nodemailer = require('nodemailer');

module.exports = function(credentials){
	var mailTransport = nodemailer.createTransport('SMTP',{
		service: 'yahoo',
		auth: {
			user: credentials.gmail.user,
			pass: credentials.gmail.password,
		}
	});
	var from = '"Escuela de Escalada Libre de Torrelodones" <info@freeclimbtorrelodones.com>';
	var errorRecipient = 'youremail@gmail.com';
	
	return {

		send: function(to, subj, body){
			mailTransport.sendMail({
				from: from,
				to: to,
				subject: subj,
				html: body,
				generateTextFromHtml: true
			}, function(err){
				if(err) console.error('No ha sido posible enviar el email: ' + err);
			});
		},
		
		emailError: function(message, filename, exception){
			var body = '<h1>Error en el portal de la Escuela de Escalada Libre de Torrelodones</h1>' +
			'mensaje:<br><pre>' + message + '</pre><br>';
			if(exception) body += 'excepción:<br><pre>' + exception + '</pre><br>';
			if(filename) body += 'nombre_fichero:<br><pre>' + filename + '</pre><br>';
			mailTransport.sendMail({
				from: from,
				to: errorRecipient,
				subject: 'Error en el portal de la Escuela de Escalada Libre de Torrelodones',
				html: body,
				generateTextFromHtml: true
			}, function(err){
				if(err) console.error('No ha sido posible enviar el email: ' + err);
			});
		},
	}
};