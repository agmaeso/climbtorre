var cluster = require('cluster');

function startWorker() {
	var worker = cluster.fork();
	console.log('CLUSTER: Worker %d arrancado', worker.id);
}

if(cluster.isMaster){
	require('os').cpus().forEach(function(){
		startWorker();
 	});
	// registra la desconexión de cualquier worker; 
	// cuando esto pasa, luego debería terminar (exit), osea que esperaremos
	// el evento exit para lanzar un nuevo worker de reemplazo
	cluster.on('disconnect', function(worker){
		console.log('CLUSTER: Worker %d desconectado del cluster.', worker.id);
	});

	// cuando un worker muera (exit), creo un worker para reemplazarlo
	cluster.on('exit', function(worker, code, signal){
		console.log('CLUSTER: Worker %d muerto con código: %d (%s)', worker.id, code, signal);
		startWorker();
	});
} else {
	// arranca la app en un worker
	require('./climbtorre.js')();
}