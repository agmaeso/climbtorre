var loadtest = require('loadtest'); // librería de tests de stress
var expect = require('chai').expect; 

suite('Stress tests', function(){
	test('La homepage debería procesar 100 rps (req/seg)', function(done){ 
		var options = {
			url: 'http://localhost:4000',
			concurrency: 4,
			maxRequests: 100
		};
		loadtest.loadTest(options, function(err,result){
			expect(!err);
			expect(result.totalTimeSeconds < 1);
			done();
		});
	});
});
