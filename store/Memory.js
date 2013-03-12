//
// Copyright (c) 2012-2013, Peter Jekel
// All rights reserved.
//
//	The Checkbox Tree (cbtree) is released under to following three licenses:
//
//	1 - BSD 2-Clause								(http://thejekels.com/cbtree/LICENSE)
//	2 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	3 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["module",
				"dojo/_base/declare",
				"dojo/_base/lang",
				"dojo/Deferred",
				"dojo/request",
				"dojo/Stateful",
				"dojo/request/handlers",
				"dojo/store/util/QueryResults",
				"../errors/createError!../errors/CBTErrors.json",
				"../util/QueryEngine",
				"../util/shim/Array"						 // ECMA-262 Array shim
			 ], function (module, declare, lang, Deferred, request, Stateful, handlers,
										 QueryResults, createError, QueryEngine) {

	// module:
	//		cbtree/store/Memory
	// summary:
	//		This store implements the cbtree/store/api/Store API which is an extension
	//		to the dojo/store/api/Store API.

	var CBTError = createError( module.id );		// Create the CBTError type.
	var undef;
	
	function correctException( error ) {
		// summary:
		//		Work-around for a dojo 1.8/1.9 XHR bug. Whenever a XHR requests fails
		//		the server response is still processed by the 'handleAs' data handler
		//		resulting in an incorrect error name (SyntaxError) and message.
		// Note:
		//		Bug filed as: http://bugs.dojotoolkit.org/ticket/16223
		// tag:
		//		Private
		if (error.response) {
			switch (error.response.status) {
				case 404:
					error.message = error.response.url.match(/[^?#]*/)[0];
					error.name    = "NotFoundError";
			}
		}
		return error;
	}

	function readOnly( property ) {
		throw new CBTError( "ReadOnly", "set", "property ["+property+"] is READ-ONLY");
	}	

	var Memory = declare([Stateful], {
		// summary:
		//		This is a memory object store implementing the cbtree/store/api/Store
		//		API. The store objects can be loaded using either in-memory data or a
		//		URL. The data is pre-processed using the default dojo/request handlers
		//		or the user can register a custom handler to pre-process, for example,
		//		Comma Separated Values (CSV).
		//
		//		The default QueryEngine, cbtree/stores/util/QueryEngine, adds support
		//		for property value arrays and case insensitive queries and sorting by
		//		means of the additional 'ignoreCase' property.
		//		(See cbtree/store/api/Store for more details).
		//
		// NOTE:
		//		In order to index the store the store property idProperty MUST be set
		//		otherwise objects can only be retrieved using the query() method.

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
		//		pairs object, the object should looks like:
		//
		//			{ handler: Function|Object,
		//				options: Object?
		//			}
		//
		//		If the handler property is an object the object MUST have a property
		//		named 'handler' whose value is a function.	In this case the handler
		//		object provides	the scope/closure for	the handler function and the
		//		options, if any, are mixed into the scope. For example:
		//
		//			dataHandler: { handler: csvHandler,
		//										 options: { fieldNames:["col1", "col2"] }
		//									 }
		//		The handler function has the following signature:
		//
		//			handler( response )
		//
		//		The response argument is a JavaScript key:value pairs object with a
		//		"text" or "data" property.
		//
		//		(See cbtree/stores/handlers/csvHandler.js for an example handler).
		dataHandler: null,

		// defaultProperties: Object
		//		A JavaScript key:values pairs object whose properties and associated
		//		values are added to new store objects if such properties are missing
		//		from the new store object.
		defaultProperties: null,

		// filter: Object | Function
		//		Filter object or function applied to the store data prior to loading
		//		the store. The filter property is used to load a subset of objects
		//		in the store.
		filter: null,
		
		// handleAs: String
		//		If the handleAs property is omitted and the data property is specified
		//		no action is taken on the data. Whenever the url property is specified
		//		the handleAs property defaults to "json".
		handleAs: null,

		// idProperty: String
		//		The property name to use as the object identity property. The value of
		//		this property should be unique. If the object being added to the store
		//		does NOT have this property it will be added to the object.
		idProperty: "id",

		// queryEngine: Function
		//		Defines the query engine to use for querying the data store
		queryEngine: QueryEngine,

		// url: String
		//		The Universal Resource Location (URL) to retrieve the data from. If
		//		both	the data and url properties	are specified the	data property
		//		takes precendence. (See also 'handleAs')
		url: null,

		// End constructor keyword
		//=========================================================================

		// total: Number [read-only]
		//		The total number of objects currently in the store.
		total: 0,

		_indexStore: true,

		//=========================================================================
		// Constructor

		constructor: function (/*Object*/ kwArgs) {
			// summary:
			//		Creates a generic memory object store capable of loading data from
			//		either an in memory data object or URL.	 If both the data and url
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
			this._indexId     = {};
			this.total        = 0;

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
						throw new CBTError( "InvalidType", "constructor", "handler must be a function");
				}
				if (handler) {
					// Register the new or override an existing data handler.
					handlers.register( this.handleAs, (scope ? lang.hitch(scope, handler) : handler));
					if (scope && options) {
						setter ? setter.call(scope, options) : lang.mixin(scope, options);
					}
				}
			}
		},

		destroy: function () {
			// summary:
			//		Release all memory and mark store as destroyed.
			this._data.forEach( function (object) {
				object._destoyed = true;
			});
			this._destroyed = true;
			this._indexId   = {};
			this._data      = [];
		},

		//=========================================================================
		// Getters & Setters (see Stateful.js)

		_autoLoadSetter: function (autoLoad) {
			this.autoLoad = !!autoLoad;
		},
		
		_dataSetter: function ( data ) {
			if (this.autoLoad) {
				this.load({data:data});
			} else {
				this.data = data;
			}
		},

		_eventableSetter: function () {
			readOnly( "eventable" );
		},
		
		_hierarchicalSetter: function () {
			readOnly( "hierarchical" );
		},

		_idPropertySetter: function ( property ) {
			this._indexStore = !!property;
			this.idProperty  = property;
		},

		_urlSetter: function ( url ) {
			if (typeof url == "string") {
				if (this.autoLoad) {
					this.load({url:url});
				} else {
					this.url = url;
				}
			} else {
				throw new CBTError("InvalidType", "_urlSetter","URL property must be of type string");
			}
		},

		//=========================================================================
		// Private methods

		_anyToObject: function (/*any*/ something, /*Boolean?*/ strict) {
			// summary:
			//		Returns the store object associated with "something".
			// something:
			//		Object, string or number
			// strict:
			//		Boolean, if true and 'something' is an object it must qualify
			//		as a valid store object.
			// returns:
			//		Object | undefined
			//tag:
			//		Private
			if (something) {
				var strict = strict || false;
				var objId;

				switch (typeof something) {
					case "string":
					case "number":
						objId = something;
						break;
					case "object":
						if (strict) {
							if (!this.isItem(something)) {
								throw new CBTError("InvalidObject", "_anyToObject");
							}
							return something;
						}
						objId = this.getIdentity(something);
						break;
					default:
						return;
				}
				return this.get(objId);
			}
		},

		_applyDefaults: function (/*String|Number*/ id, /*Object*/ object) {
			// summary:
			//		 Add missing default properties and set the object id.
			// id:
			//		Object identification.
			// object:
			//		Store object.
			// tag:
			//		Private
			if (this.defaultProperties) {
				for (var prop in this.defaultProperties) {
					object[prop] = object[prop] || this.defaultProperties[prop];
				}
			}
			if (this.idProperty) {
				object[this.idProperty] = id;
			}
		},

		_getObjectId: function (/*Object*/ object,/*PutDirectives*/ options) {
			// summary:
			//		Get the object id. If the object has no id property (this.idProperty)
			//		and no "id" property was specified in the options either, one will be
			//		randomly assigned.
			// object:
			//		The object to store.
			// options:
			//		Additional metadata for storing the data which may include the "id"
			//		property.
			// tag:
			//		Private
			var id;

			if (options && "id" in options) {
				id = options.id;
			} else {
				id = this.getIdentity(object);
			}
			if (id === null || id === undef) {
				id = Math.random();
			}
			return id;
		},

		_indexData: function () {
			// summary:
			//		Re-index the store data
			// tag:
			//		Private
			if (this._indexStore) {
				var idProp = this.idProperty;
				var index  = this._indexId = {};
				var data   = this._data;
				var i;

				for(i=0; i<data.length; i++) {
					index[data[i][idProp]] = i;
				}
			}
		},

		_loadData: function (/*Object[]?*/ data) {
			// summary:
			//		Load an array of data objects into the store and indexes it.	This
			//		method is called after the raw data has been processed by the data
			//		handler in case the 'handleAs' property is set.
			// data:
			//		An array of objects.
			// tag:
			//		Private
			var object, id, i;
			var self = this;
			var at;
			
			this._indexId = {};
			this._data    = [];
			this.data     = null;

			data = data || [];

			if (data instanceof Array) {
				try {
					for (i=0; i<data.length; i++) {
						object = data[i];
						id = this._getObjectId(object);
						at = this._indexId[id] || -1;
						if (at >= 0) {
							// Different record, same id. Don't overwrite the existing record
							// as it will mess up the store hierarchy and childrens index.
							console.warn( new CBTError("ItemExist", "_loadData", "Object with ID: ["+id+"] already exist") );
						} else {
							this._writeObject(id, object, at);
						}
					}
					this._indexData();
					this._storeLoaded.resolve(true);
				} catch(err) {
					this._storeLoaded.reject(err);
				}
			} else {
				var err = new CBTError("InvalidData", "_loadData");
				this._storeLoaded.reject(err);
			}
			delete this._isLoading;
		},

		_writeObject: function (/*String|Number*/ id, /*Object*/ object,/*Number*/ index,/*PutDirectives*/ options) {
			// summary:
			//		Store an object.
			// id:
			//		Object identification.
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

			if (index > -1) {
				// Update existing store object
				this._data[index] = object;
			}else{
				// Add a new store object adding any missing default properties.
				this._applyDefaults(id, object);
				if (this._indexStore) {
					this._indexId[id] = this._data.push(object) - 1;
				} else {
					this._data.push(object);
				}
				this.total++;
			}
			return id;
		},

		_xhrGet: function (url, handleAs) {
			return request(this.url, {method:"GET", handleAs: handleAs, preventCache: true});
		},

		//=========================================================================
		// Public cbtree/store/api/store API methods

		add: function (/*Object*/ object,/*PutDirectives?*/ options) {
			// summary:
			//		Creates an object, throws an error if the object already exists
			// object:
			//		The object to store.
			// options:
			//		Additional metadata for storing the data.	Includes an "id"
			//		property if a specific id is to be used.
			// returns:
			//		String or Number
			// tag:
			//		Public
			var id = this._getObjectId(object, options);
			var at = this._indexId[id];

			if (at >= 0) {
				throw new CBTError("ItemExist", "add");
			}
			return this._writeObject(id, object, at, options);
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
			return this._data[this._indexId[id]];
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
			if (object && this.idProperty) {
				return object[this.idProperty];
			}
		},

		isItem: function (/*Object*/ object) {
			// summary:
			//		Test if object is a member of this store.
			// object:
			//		Object to test.
			// returns:
			//		Boolean true of false
			// tag:
			//		Public
			if (object && typeof object == "object") {
				return (object == this.get(this.getIdentity(object)));
			}
			return false;
		},

		load: function (options) {
			// summary:
			//		Implements a simple store loader to load data.
			// options:
			//		cbtree/store/api/Store.LoadDirectives
			// returns:
			//		dojo/promise/Promise
			// tag:
			//		Public
			if (!this._isLoading && !this._storeLoaded.isFulfilled()) {
				this._isLoading = true;
				if (options) {
					if (options.data) {
						this.data = options.data;
					} else if (options.url) {
						this.url = options.url;
					}
					if (options.filter && options.all != true) {
						//Filter data to be loaded...
						this.filter = options.filter;
					}
				}

				if (this.data || this.url) {
					var queryFunc = this.filter ? QueryEngine(this.filter): function(data) {return data;};
					if (this.data) {
						if (this.handleAs)  {
							var response = {data: this.data, options:{handleAs: this.handleAs}};
							this.data = handlers( response ).data;
						}
						this._loadData( queryFunc(this.data) );
						this.url = null;
					} else {
						var result, header, self = this;
						if (!this.handleAs) {
							this.handleAs = "json";
						}
						result = this._xhrGet( this.url, this.handleAs, null );
						result.then( 
							function (data){
								self._loadData( queryFunc(data) );
							}, 
							function (err) {
								self._storeLoaded.reject( new CBTError( correctException(err), "load"));
							});
					}
				} else {
					this._loadData( null );		// Empty store
				}
			}
			return this._storeLoaded.promise;
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
			var id = this._getObjectId(object, options);
			var at = this._indexId[id];

			if (at >= 0) {
				if (options && options.overwrite === false) {
					throw new CBTError("ItemExist", "put");
				}
			}
			return this._writeObject(id, object, at, options);
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
			//	|	var store = new Memory({
			//	|		data: [
			//	|			{id: 1, name: "one", prime: false },
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
			// tag:
			//		Public
			var self = this;

			if (this._storeLoaded.isFulfilled()) {
				return QueryResults( this.queryEngine(query, options)(this._data, false) );
			} else {
				// If the store data isn't loaded yet defer the query until it is...
				return QueryResults( this._storeLoaded.then( function () {
					return self.queryEngine(query, options)(self._data, false)
				}));
			}
		},

		ready: function (callback, errback, scope) {
			// summary:
			//		Execute the callback when the store data has been loaded. If an error
			//		is detected during the loading process errback is called instead.
			// callback:
			// errback:
			// scope:
			// returns:
			//		dojo/promise/Promise
			// tag:
			//		Public
			return this._storeLoaded.then(
				lang.hitch( (scope || this),callback), 
				lang.hitch( (scope || this),errback)
			);
		},

		remove: function (/*String|Number*/ id) {
			// summary:
			//		Deletes an object by its identity
			// id:
			//		The identity to use to delete the object
			// returns:
			//		Returns true if an object was removed otherwise false.
			// tag:
			//		Public
			var at = this._indexId[id];
			if (at >= 0) {
				this._data.splice(at, 1);
				// now we have to reindex
				this._indexData();
				this.total--;
				return true;
			}
			return false;
		},

		toString: function () {
			return "[object MemoryStore]";
		}

	});	/* end declare() */

	return Memory

});
