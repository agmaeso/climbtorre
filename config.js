module.exports = {
	bundles: {
		clientJavaScript: {
			main: {
				file: '/js/climbtorre.min.js',
				location: 'head',
				contents: [
					'/js/contact.js',
					'/js/cart.js',
				]
			}
		},
		clientCss: {
			main: {
				file: '/css/climbtorre.min.css',
				contents: [
					'/css/main.css',
					'/css/cart.css',
				]
			}
		},
	},
}
