//
// Copyright (c) 2010-2013, Peter Jekel
// All rights reserved.
//
//	The Checkbox Tree (cbtree), also known as the 'Dijit Tree with Multi State Checkboxes'
//	is released under to following three licenses:
//
//	1 - BSD 2-Clause							 (http://thejekels.com/cbtree/LICENSE)
//	2 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	3 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
//	In case of doubt, the BSD 2-Clause license takes precedence.
//
define(["dojo/_base/declare",
				"dojo/_base/lang",
				"dojo/Deferred",
				"dojo/request",
				"dojo/request/handlers",
				"dojo/store/util/QueryResults",
				"./util/QueryEngine",
				"../shim/Array"                 // ECMA-262 Array shim
			 ], function (declare, lang, Deferred, request, handlers, QueryResults, QueryEngine) {

	// module:
	//		cbtree/store/Memory
	// summary:
	//		This store implements the cbtree/store/api/Store API which is an extension
	//		to the dojo/store/api/Store API.

	var moduleName = "cbTree/store/Memory";

	var Memory = declare([], {
		// summary:
		//		This is a memory object store implementing the cbtree/store/api/Store
		//		API. The store objects can be loaded  using either in-memory data or a
		//		URL. The data is pre-processed using the default dojo/request handlers
		//		or the user can register a custom handler to pre-process, for example,
		//		Comma Separated Values (CSV).
		//
		//		The default QueryEngine, cbtree/stores/util/QueryEngine, adds support
		//		for property value arrays and case insensitive queries and sorting by
		//		means of the additional 'ignoreCase' property.

		//=========================================================================
		// Constructor keyword arguments:

		// autoLoad: Boolean
		//		Indicates, when a URL is specified, if the data should be loaded during
		//		store construction or deferred until the user explicitly calls the load
		//		method.
		autoLoad: true,

		// data: Array
		//		The array of all raw objects to be loaded in the memory store. This
		//		property is only used during store construction.
		//		(See also the 'dataHandler' and 'handleAs' properties).
		data: null,

		// dataHandler: Function|Object
		//		The data handler for the data/response. If dataHandler is an key:value
		//		pairs object,	the object should looks like:
		//
		//			{ handler: Function|Object,
		//				options: Object?
		//			}
		//
		//		If the handler property is an object the object MUST have a property
		//		named 'handler' whose value is a function.  In this case the handler
		//		object provides  the scope/closure for the handler function  and the
		//		options, if any, are mixed into the scope. For example:
		//
		//			dataHandler: { handler: csvHandler,
		//										 options: { fieldNames:["col1", "col2"] }
		//									 }
		//		(See cbtree/stores/handlers/csvHandler.js for an example handler).
		dataHandler: null,

		// defaultProperties: Object
		//		A JavaScript key:values pairs object whose properties and associated
		//		values are added to new store objects if such properties are missing
		//		from the new store object.
		defaultProperties: null,

		// handleAs: String
		//		If the handleAs property is omitted and the data property is specified
		//		no action is taken on the data. Whenever the url property is specified
		//		the handleAs property defaults to "json".
		handleAs: null,

		// idProperty: String
		//		Indicates the property to use as the identity property. The values of this
		//		property should be unique.
		idProperty: "id",

		// queryEngine: Function
		//		Defines the query engine to use for querying the data store
		queryEngine: QueryEngine,

		// url: String
		//		The Universal Resource Location (URL) to retrieve the data from. If
		//		both  the data and url properties  are specified the  data property
		//		takes precendence. (See also 'handleAs')
		url: null,

		//=========================================================================
		// Constructor

		constructor: function (/*Object*/ kwArgs) {
			// summary:
			//		Creates a generic memory object store capable of loading data from
			//		either an in memory data object or URL.   If both the data and url
			//		properties are specified the data object takes precedence.
			// kwArgs:
			//		A JavaScript key:value pairs object
			//			{
			//				autoLoad: Boolean?,
			//				data: Object[]?,
			//				handleAs: String?,
			//				idProperty: String?,
			//				dataHandler: Object|Function?
			//				queryEngine: Function?,
			//				url: String?
			//			}
			var store = this;

			this._storeLoaded = new Deferred();
			this._isLoading   = false;
			this._data        = [];
			this._index       = {};

			// Mixin the keyword arguments.
			declare.safeMixin( this, kwArgs );

			if (this.handleAs && this.dataHandler) {
				var scope   = this.dataHandler.handler || this.dataHandler;
				var options = this.dataHandler.options;
				var setter, handler;

				switch (typeof scope) {
					case "function":
						scope = new scope();
						if (typeof scope.handler != "function") {
							handler = this.dataHandler;
							scope   = undefined;
							break;
						}
						/* NO BREAK HERE */
					case "object":
						handler = scope.handler;
						setter  = scope.set;
						break;
					default:
						throw new Error(moduleName+"::postscript(): handler must be a function");
				}
				if (handler) {
					// Register the new or override an existing data handler.
					handlers.register( this.handleAs, (scope ? lang.hitch(scope, handler) : handler));
					if (scope && options) {
						setter ? setter.call(scope, options) : lang.mixin(scope, options);
					}
				}
			}

			this.autoLoad = !!this.autoLoad;
			if (this.data) {
				// If the 'handleAs' property is set run the data by the data handler first.
				if (this.handleAs) {
					var response = {data: this.data, options:{handleAs: this.handleAs}};
					this.data = handlers( response );
				}
				this._isLoading = true;
				this._setData(store.data);
			} else {
				if (this.url) {
					if (typeof this.url == "string") {
						if (this.autoLoad) {
							this.load();
						}
					} else {
						throw new Error(moduleName+"::_urlSetter(): URL property must be of type string");
					}
				} else {
					if (this.autoLoad) {
						this._setData();		// No data or URL specified.
					}
				}
			}
		},

		//=========================================================================
		// Private methods

		_indexData: function () {
			// summary:
			//		Re-index the store data
			// tag:
			//		Private
			var idProp = this.idProperty;
			var data   = this._data;
			var index  = this._index = {};
			var i;

			for(i=0; i<data.length; i++) {
				index[data[i][idProp]] = i;
			}
		},

		_setData: function (/*Object[]*/ data) {
			// summary:
			//		Insert an array of data objects into the store and indexes it. This
			//		method is called after the raw data has been processed by the data
			//		handler in case the 'handleAs' property is set.
			// data:
			//		An array of objects.
			// tag:
			//		Private
			var idProp, object, i;

			this._data = [];
			this.data  = null;

			data = data || [];

			if (data && data.items) {
				// just for convenience with the data format IFRS expects
				this.idProperty = data.identifier;
				data = data.items;
			}
			idProp = this.idProperty;

			if (data instanceof Array) {
				try {
					// Pre-process all data objects making sure each will have an id property
					// if it doesn't have one already.
					for (i=0; i<data.length; i++) {
						object = data[i];
						this._setObjectId(object);
						this._writeObject(object);
					}
					this._indexData();
					this._storeLoaded.resolve(true);
				} catch(err) {
					this._storeLoaded.reject(err);
				}
			} else {
				var err = new Error(moduleName+"::_setData(): data must be an array of objects");
				this._storeLoaded.reject(err);
			}
			delete this._isLoading;
		},

		_setObjectId: function (/*Object*/ object,/*PutDirectives*/ options) {
			// summary:
			//		Set the object id. If the object has no id property (this.idProperty)
			//		and no "id" property was specified in the options either, one will be
			//		randomly assigned.
			// object:
			//		The object to store.
			// options:
			//		Additional metadata for storing the data which may include the "id"
			//		property.
			// tag:
			//		Private
			var id = object[this.idProperty];
			if (options && "id" in options) {
				id = options.id;
			}
			object[this.idProperty] = id || Math.random();
			return id;
		},

		_writeObject: function (/*Object*/ object,/*Number*/ index,/*PutDirectives*/ options) {
			// summary:
			//		Store an object.
			// object:
			//		The object to store.
			// index:
			//		Index number of the object in the stores data array. If specified it
			//		indicates an existing object in the store otherwise it's a new store
			//		object.
			// options:
			//		Additional metadata for storing the data.
			// returns:
			//		The object ID
			// tag:
			//		Private
			var id = object[this.idProperty];

			if (index > -1) {
				// Update existing store object
				this._data[index] = object;
			}else{
				// Add a new store object adding any missing default properties.
				if (this.defaultProperties) {
					for (prop in this.defaultProperties) {
						object[prop] = object[prop] || this.defaultProperties[prop];
					}
				}
				this._index[id] = this._data.push(object) - 1;
			}
			return id;
		},

		//=========================================================================
		// Public dojo/store/api/store API methods

		add: function (/*Object*/ object,/*PutDirectives?*/ options) {
			// summary:
			//		Creates an object, throws an error if the object already exists
			// object:
			//		The object to store.
			// options:
			//		Additional metadata for storing the data.  Includes an "id"
			//		property if a specific id is to be used.
			// returns:
			//		String or Number
			// tag:
			//		Public
			var id = this._setObjectId(object, options);
			var at = this._index[id];

			if (at) {
				throw new Error("Object already exists");
			}
			return this._writeObject(object, at, options);
		},

		get: function (/*String|Number*/ id) {
			// summary:
			//		Retrieves an object by its identity
			// id:
			//		The identity to use to lookup the object
			// returns:
			//		The object in the store that matches the given id.
			// tag:
			//		Public
			return this._data[this._index[id]];
		},

		getChildren: function (/*Object*/ parent, /*QueryOptions?*/ options) {
			// summary:
			//		Retrieves the children of an object.
			// parent:
			//		The object to find the children of.
			// options:
			//		Additional options to apply to the retrieval of the children.
			// returns:
			//		dojo/store/api/Store.QueryResults: A result set of the children of
			//		the parent object.
			// tag:
			//		Public
			var query = {};

			query[this.parentProperty] = this.getIdentity(parent);
			return this.query( query, options );
		},

		getIdentity: function (/*Object*/ object) {
			// summary:
			//		Returns an object's identity
			// object:
			//		The object to get the identity from
			// returns:
			//		String or Number
			// tag:
			//		Public
			return object && object[this.idProperty];
		},

		put: function (/*Object*/ object,/*PutDirectives?*/ options) {
			// summary:
			//		Stores an object
			// object:
			//		The object to store.
			// options:
			//		Additional metadata for storing the data.
			// returns:
			//		String or Number
			// tag:
			//		Public
			var id = this._setObjectId(object, options);
			var at = this._index[id];

			if (at) {
				if (options && options.overwrite === false) {
					throw new Error("Object already exists");
				}
			}
			return this._writeObject(object, at, options);
		},

		query: function (/*Object*/ query,/*QueryOptions?*/ options) {
			// summary:
			//		Queries the store for objects.
			// query: Object
			//		The query to use for retrieving objects from the store.
			// options:
			//		The optional arguments to apply to the resultset.
			// returns: dojo/store/api/Store.QueryResults
			//		The results of the query, extended with iterative methods.
			//
			// example:
			//		Given the following store:
			//
			// 	|	var store = new Memory({
			// 	|		data: [
			// 	|			{id: 1, name: "one", prime: false },
			//	|			{id: 2, name: "two", even: true, prime: true},
			//	|			{id: 3, name: "three", prime: true},
			//	|			{id: 4, name: "four", even: true, prime: false},
			//	|			{id: 5, name: "five", prime: true}
			//	|		]
			//	|	});
			//
			//	...find all items where "prime" is true:
			//
			//	|	var results = store.query({ prime: true });
			//
			//	...or find all items where "even" is true:
			//
			//	|	var results = store.query({ even: true });
			return QueryResults(this.queryEngine(query, options)(this._data));
		},

		remove: function (/*String|Number*/ id) {
			// summary:
			//		Deletes an object by its identity
			// id:
			//		The identity to use to delete the object
			// returns:
			//		Returns true if an object was removed otherwise false.
			var at = this._index[id];
			if (at) {
				this._data.splice(at, 1);
				// now we have to reindex
				this._indexData();
				return true;
			}
			return false;
		},

		//=========================================================================
		// Public dojo/store/api/store API extensions

		load: function (options) {
			// summary:
			//		Implements a simple load to load data using a URL.
			// returns:
			//		dojo/promise/Promise
			// tag:
			//		Public, Extension
			if (!this._isLoading && !this._storeLoaded.isFulfilled()) {
				if (options && options.url) {
					this.url = options.url;
				}
				if (!this.handleAs) {
					this.handleAs = "json";
				}
				if (this.url) {
					var result, self = this;
					this._isLoading = true;
					result = request(this.url, {method:"GET", handleAs: this.handleAs, preventCache: true});
					result.then( function (data) { self._setData(data);	}, this._storeLoaded.reject	);
				} else {
					throw new Error("No URL specified for the store");
				}
			}
			return this._storeLoaded.promise;
		},

		onLoad: function (callback, errback) {
			// summary:
			//		Execute the callback when the store data has been loaded. If an error
			//		is detected during the loading process errback is called instead.
			// returns:
			//		dojo/promise/Promise
			// tag:
			//		Public, Extension
			return this._storeLoaded.then(callback, errback);
		}

	});	/* end declare() */

	return Memory

});
