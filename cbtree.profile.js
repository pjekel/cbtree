var copyOnly = function(filename, mid) {
	var list = {
		"cbtree/cbtree.profile":1,
		"cbtree/cbtree.build":1,
		"cbtree/package.json":1
	};
	return (mid in list) || (/^cbtree\/themes\//.test(mid) && !/\.css$/.test(filename)) || /(png|jpg|jpeg|gif|tiff)$/.test(filename);
};

var profile = {

	releaseDir: "../release",
	basePath : "..",
	action: "release",
	cssOptimize: "comments",
	optimize: "closure",
	layerOptimize: "closure",
	selectorEngine: "acme",
	mini: true,

	layers: {
		"dojo/dojo": {
				include: [
					"dojo/dojo",
					"dojo/_base/array",
					"dojo/data/ItemFileWriteStore",
					"dojo/domReady",
					"dojo/dom",
					"dojo/i18n",
					"dojo/ready"
				],
				customBase: true,
				boot: true
		},
		"cbtree/main": {
				include: [
					"cbtree/main"
				]
		}
	},
	 
	resourceTags: {
		amd: function(filename, mid) {
			return !copyOnly(filename, mid) && /\.js$/.test(filename);				 
		},
		
		copyOnly: function(filename, mid) {
			return copyOnly(filename, mid);
		}
	}
};
