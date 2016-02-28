var Browser = require('zombie'),
	assert = require('chai').assert;
var browser;

suite('Cross-Page Tests', function(){

	setup(function(){
		browser = new Browser();
 	});

 	test('solicitando un guia desde la página de bouldering debería rellenar el campo referrer', function(done){
 		var referrer = 'http://localhost:4000/areas/bouldering';
 		browser.visit(referrer, function(){
 			browser.clickLink('.requestGuide', function(){
 				browser.assert.input('#referrer', referrer);
				done();
 			});
 		});
 	});
 
 	test('solicitando un guia desde la página de artificial debería rellenar el campo referrer', function(done){
 		var referrer = 'http://localhost:4000/areas/artificial';
 		browser.visit(referrer, function(){
 			browser.clickLink('.requestGuide', function(){
 				assert(browser.field('form input[id="referrer"]').value === referrer);
 				done();
 			});
 		});
 	});
 
 	test('visitar la pagina "solicita un guía" directamente debería dejar el campo ' +
 		'referrer vacío', function(done){
 		browser.visit('http://localhost:4000/areas/request-guide', function(){
			assert(browser.field('form input[id="referrer"]').value === '');
 			done();
		});
	});

});