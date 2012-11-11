define(["dojo/_base/declare",
				"dojo/request/xhr",
				"dojo/Deferred",
				"dojo/store/Memory",
				"./util/SimpleQueryEngine"			// Provide support for array properties.
			 ], function (declare, xhr, Deferred, Memory, SimpleQueryEngine){

// module:
//		cbtree/stores/ObjectStore

	return declare([Memory], {
		// summary:
		//		This is a basic in-memory object store derived from dojo/store/Memory
		//		extended with the ability to load data from a URL.
		//		In addition, the cbtree/stores/util/SimpleQueryEngine provide support
		//		for array properties enabling multi-parented store items.

		// queryEngine: Function
		//		Defines the query engine to use for querying the data store
		queryEngine: SimpleQueryEngine,

		// _inProgress: Boolean
		_inProgress: false,

		constructor: function(options){
			// summary:
			//		Creates a generic memory object store capable of loading data from
			//		either an in memory data object or URL.   If both the data and url
			//		properties are specified the data object takes precedence.
			// options:
			//		data:
			//		url:
			this.loaded = new Deferred();
			if (this.data.length > 0) {
				this.loaded.resolve(true);
			}
		},

		loadStore: function () {
			// summary:
			//		Implements a simple loader to load data using a URL.
			// returns:
			//		dojo/promise/Promise
			// tag:
			//		Public
			if (!this._inProgress && !this.loaded.isFulfilled()) {
				if (this.url) {
					var result = xhr(this.url, {method:"GET", handleAs: "json", preventCache: true});
					var self   = this;

					this._inProgress = true;
					result.then(
						function(data) {
							self.setData( data );
							self.loaded.resolve(true);
						},
						self.loaded.reject );
					result.always( function () {self._inProgress = false;});
				} else {
					throw new Error("No URL");
				}
			}
			return this.loaded.promise;
		}

	});

});
