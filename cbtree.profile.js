var testResourceRe = /^cbtree\/tests\//;
var excludePath = [ /^cbtree\/((.*)?\/)?tests\//,
									  /^cbtree\/((.*)?\/)?demos\//,
									  /^cbtree\/((.*)?\/)?json\//,
									  /^cbtree\/((.*)?\/)?csv\//,
									  /^cbtree\/((.*)?\/)?documentation\//
									 ];
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
					"dojo/_base/array",
					"dojo/dojo",
					"dojo/data/ItemFileWriteStore",
					"dojo/dom",
					"dojo/domReady",
					"dojo/i18n",
					"dojo/ready"
				],
				customBase: true,
				boot: true
		},
		"cbtree/main": {
				include: [
					// Legacy dojo/data store models (remove with dojo 2.0)
					"cbtree/models/FileStoreModel",
					"cbtree/models/ForestStoreModel",
					"cbtree/models/TreeStoreModel",
					"cbtree/models/StoreModel-API",
					"cbtree/data/FileStore",
					// New dojo/store & cbtree/store models
					"cbtree/model/FileStoreModel",
					"cbtree/model/ForestStoreModel",
					"cbtree/model/StoreModel-API",
					"cbtree/model/TreeStoreModel",
					// New cbtree/store stores & wrappers
					"cbtree/store/Eventable",
					"cbtree/store/FileStore",
					"cbtree/store/Hierarchy",
					"cbtree/store/Memory",
					"cbtree/store/ObjectStore",
					// cbtree
					"cbtree/CheckBox",
					"cbtree/TreeStyling",
					"cbtree/Tree"
				]
		}
	},

	resourceTags: {
		test: function(filename, mid){
			var result = testResourceRe.test(mid);
			return testResourceRe.test(mid) || mid=="cbtree/tests" || mid=="cbtree/demos";
		},

		amd: function(filename, mid) {
			return !testResourceRe.test(mid) && !copyOnly(filename, mid) && /\.js$/.test(filename);
		},

		copyOnly: function(filename, mid) {
			return copyOnly(filename, mid);
		},

		miniExclude: function(filename, mid){
			var result = excludePath.some( function (regex) {
				return regex.test(mid);
			});
			return result;
		}
	}
};
