define(["dojo/_base/array", 
				"dojo/_base/declare", 
				"dojo/_base/json",
				"dojo/_base/lang", 
				"dojo/_base/window", 
				"dojo/_base/xhr",
				"dojo/data/util/filter", 
				"dojo/Evented" 
], function ( array, declare, json, lang, window, xhr, filterUtil, Evented) {
	// module:
	//		cbtree/store/FileStore
	// summary:

	var cbtreeFileStore = declare([Evented],{
		//	summary:
		//		The cbtreeFileStore implements the dojo.data.api.Read API and reads
		//		data from JSON files that have contents in this format --
		//		{ items: [
		//			{ name:'Kermit' directory: true, size: 1234, children: []},
		//		]}
		//
		constructor: function (/* Object */ args) {
			//	summary: constructor
			//	args: {url: String}

			this._arrayOfAllItems = [];
			this._arrayOfTopLevelItems = [];
			this._itemsByIdentity = null;

			this._features = {'dojo.data.api.Read':true, 
												'dojo.data.api.Write':true,
												'dojo.data.api.Identity':true,
												'dojo.data.api.Notification': true };
												
			this._storeRefPropName = "_S"; // Default name for the store reference to attach to every item.
			this._rootItemPropName = "_RI"; // Default Item Id for isItem to attach to every item.
			this._reverseRefMap = "_RRM"; // Default attribute for constructing a reverse reference map for use with reference integrity
			this._loadInProgress = false; //Got to track the initial load to prevent duelling loads of the dataset.
			this._loadFinished = false;
			this._queuedFetches = [];

			for( var prop in args ) {
				this.set(prop, args[prop]);
			}
		},

		//==============================
		// Parameters to constructor

		basePath: null,
		cache: false,
		 
		//Parameter to allow users to specify if a close call should force a reload or not.
		//By default, it retains the old behavior of not clearing if close is called.  But
		//if set true, the store will be reset to default state.  Note that by doing this,
		//all item handles will become invalid and a new fetch must be issued.
		clearOnClose: false,

		//Parameter for specifying that it is OK for the xhrGet call to fail silently.
		failOk: false,

		options: [],

		// pathSeparator: [public] string
		//		The path separator to use when chaining requests for children
		//		Can be overriden by the server on initial load
		pathSeparator: "/",

		url: "",			// use "" rather than undefined for the benefit of the parser (#3539)

		//Parameter to allow specifying if preventCache should be passed to the xhrGet call or not when loading data from a url.
		//Note this does not mean the store calls the server on each fetch, only that the data load has preventCache set as an option.
		//Added for tracker: #6072
		urlPreventCache: false,

		// End Parameters to constructor
		//==============================
		
		moduleName: "cbTree/store/FileStore",

		_childrenAttr: "children",
		_identifier: "path",
		_isValidated: false,
		_labelAttr: "name",
			
		_assert: function (/* boolean */ condition) {
			if (!condition) {
				throw new Error(this.moduleName+"::_assert: assertion failed.");
			}
		},

		_assertIsItem: function (/*item*/ item) {
			//	summary:
			//		This function tests whether the item passed in is indeed an item in the store.
			//	item:
			//		The item to test for being contained by the store.
			if (!this.isItem(item)) {
				throw new Error(this.moduleName+"::_assertIsItem: Invalid item argument.");
			}
		},

		_assertIsAttribute: function (/*String */ attribute) {
			//	summary:
			//		This function tests whether the item passed in is indeed a valid 'attribute' like type for the store.
			//	attribute:
			//		The attribute to test for being contained by the store.
			if (typeof attribute !== "string") {
				throw new Error(this.moduleName+"::_assertIsAttribute: Invalid attribute argument.");
			}
		},

		_containsValue: function (	/*item*/ item, /*String*/ attribute, /*anything*/ value,/*RegExp?*/ regexp) {
			//	summary:
			//		Internal function for looking at the values contained by the item.
			//	description:
			//		Internal function for looking at the values contained by the item.  This
			//		function allows for denoting if the comparison should be case sensitive for
			//		strings or not (for handling filtering cases where string case should not matter)
			//
			//	item:
			//		The data item to examine for attribute values.
			//	attribute:
			//		The attribute to inspect.
			//	value:
			//		The value to match.
			//	regexp:
			//		Optional regular expression generated off value if value was of string type to handle wildcarding.
			//		If present and attribute values are string, then it can be used for comparison instead of 'value'
			return array.some(this.getValues(item, attribute), function (possibleValue) {
				if (possibleValue !== null && !lang.isObject(possibleValue) && regexp) {
					if (possibleValue.toString().match(regexp)) {
						return true; // Boolean
					}
				}else if (value === possibleValue) {
					return true; // Boolean
				}
			});
		},

		_deleteItem: function ( item ) {
			if (item.directory) {
				var children = item[this._childrenAttr],
						i;
				if (children.length > 0) {
					for( i=0; i<children.length; i++) {
						this._deleteItem( children[i] );
					}
				}
				item[this._childrenAttr] = [];
			}
			item[this._storeRefPropName] = null;
			if (this._itemsByIdentity) {
				var identity = item[this._identifier];
				delete this._itemsByIdentity[identity];
			}
			this._removeArrayElement(this._arrayOfAllItems, item);
			if (item[this._rootItemPropName]) {
				this._removeArrayElement(this._arrayOfTopLevelItems, item);
				this.onRoot( item, { attach: false, detach: true } );
			}
			this.onDelete(item);
		},
		
		_fetchComplete: function (requestArgs, arrayOfItems) {
			var scope = requestArgs.scope || window.global;
			var items = arrayOfItems.slice(0),
					i;

			if (requestArgs.sort) {
				if (lang.isFunction( requestArgs.sort )) {
					items.sort( requestArgs.sort );
				}
			}
			if (requestArgs.onBegin) {
				requestArgs.onBegin.call(scope, items.length, requestArgs);
			}
			if (requestArgs.onItem) {
				for(i = 0; i < items.length; ++i) {
					var item = items[i];
					if (!aborted) {
						requestArgs.onItem.call(scope, item, requestArgs);
					}
				}
			}
			if (requestArgs.onComplete) {
				requestArgs.onComplete.call(scope, (!requestArgs.onItem ? items : null), requestArgs);
			}
		},

		_getItemByIdentity: function (/* Object */ identity) {
			//	summary:
			//		Internal function to look an item up by its identity map.
			var item = null;
			if (this._itemsByIdentity) {
				if (Object.hasOwnProperty.call(this._itemsByIdentity, identity)) {
					item = this._itemsByIdentity[identity];
				}
			}
			return item; // Object
		},

		_getItemsArray: function (/*object?*/ queryOptions) {
			//	summary:
			//		Internal function to determine which list of items to search over.
			//	queryOptions: The query options parameter, if any.
			if (queryOptions && queryOptions.deep) {
				return this._arrayOfAllItems;
			}
			return this._arrayOfTopLevelItems;
		},

		_handleQueuedFetches: function () {
			//	summary:
			//		Internal function to execute delayed request in the store.
			//Execute any deferred fetches now.
			var delayedQuery,
					delayedScope,
					delayedFunc,
					fData;

			while( this._queuedFetches.length > 0 && !this._loadInProgress )
			{
					fData = this._queuedFetches.shift()
					delayedScope = fData.scope;
					delayedQuery = fData.args,
					delayedFunc  = fData.func;

					delayedFunc.call(delayedScope, delayedQuery);
			}
		},

		_isMemberOf: function (child, children) {
			var i;
			
			if (children.length > 0) {
				for (i=0; i<children.length; i++) {
					if (child[this._identifier] === children[i][this._identifier]) {
						return i;
					}
				}
			}
			return -1;
		},

		_newItem: function ( item, parentItem ) {
			var identity = item[this._identifier];
			item[this._storeRefPropName] = this;
			if (parentItem) {
				item[this._reverseRefMap] = [parentItem];
			}
			if (item.directory) {
				item[this._childrenAttr] = [];
			}
			if (this._itemsByIdentity) {
				if (!Object.hasOwnProperty.call(this._itemsByIdentity, identity)) {
					this._itemsByIdentity[identity] = item;
				}else{
					throw new Error(this.moduleName+"::_newItem: duplicate identity detected: '" +identity+"'" );
				}
			}
			this._arrayOfAllItems.push(item);
			return item;
		},
		
		_removeArrayElement: function (/* Array */ array, /*anything*/ element) {
			var index = arrayUtil.indexOf(array, element);
			if (index != -1) {
				array.splice(index, 1);
				return true;
			}
			return false;
		},

		_requestToArgs: function (request) {
			var reqParams = {};

			if (this.basePath) {
				reqParams.basePath = this.basePath;
			}
			if (request.path) {
				reqParams.path = request.path;
			}
			if (request.query) {
				reqParams.query = json.toJson(request.query);
			}
			if (request.sortFields) {
				reqParams.sortFields = json.toJson(request.sortFields);
			}
			if (request.queryOptions) {
				reqParams.queryOptions = json.toJson(request.queryOptions);
			}
			if (typeof request.start == "number") {
				reqParams.start = "" + request.start;
			}
			if (typeof request.count == "number") {
				reqParams.count = "" + request.count;
			}
			if (this.options.length > 0) {
				reqParams.options = json.toJson(this.options);
			}
			var getArgs = {	url: this.url,
											handleAs: "json",
											content: reqParams,
											preventCache: this.urlPreventCache,
											failOk: this.failOk }

			return getArgs;
		},

		_setOptionsAttr: function (value) {
			if (lang.isArray(value)) {
				this.options = value;
			}else{
				if (lang.isString(value)) {
					this.options = value.split(",");
				} else {
					throw new Error(this.moduleName + "::_setOptionsAttr: Options must be a comma separated string of keywords"
																						+ " or an array of keyword strings." );
				}
			}
			return this.options;
		},

		_updateChildren: function (item) {
			if (!item.directory) { return;	}
			if (item._expanded) {
				var childItems = item.childItems,
						children   = item[this._childrenAttr],
						child;
						
				item[this._childrenAttr] = [];

				if (childItems.length > 0) {
					var newChildren = false,
							newChild,
							orgChild,
							index,
							i;

					for( i=0; i<childItems.length; i++) {
						child = childItems[i];
						index = this._isMemberOf(child, children);
						if (index === -1) {
							newChild = this._newItem( lang.mixin( null, child), item);
							item[this._childrenAttr].push(newChild);
							this._updateChildren( newChild );
							newChildren = true;
						} 
						else // A previously known child.
						{
							orgChild = children.splice(index,1)[0];
							item[this._childrenAttr].push(orgChild);
							lang.mixin(orgChild, child);
							this._updateChildren(orgChild );
						}
					}
				}
				// Test if children have been added or removed.
//				if (this._loadFinished && item._loaded) {
				if (item._loaded) {
					if (children.length !== 0 || newChildren) {
						this.onSet( item, this._childrenAttr, item[this._childrenAttr] );
					}
				}
				if (children.length) {
					while (child = children.shift() ) {
						this._deleteItem( child );
					}
				}
				item._loaded = true;
			} 
			else // Directory not expanded
			{
				if (item._loaded === undefined) {
					item._loaded = false;
				}
			}
			delete item.childItems;	// Delete server side children definition.
		},

		_updateItem: function (item, dataObject) {
			lang.mixin(item, dataObject);
			this._updateChildren(item);
		},

		_uploadDataToStore: function (/* Object */ dataObject ) {
			//	summary:
			//		Function to parse the loaded data into item format and build the internal items array.
			//	description:
			//		Function to parse the loaded data into item format and build the internal items array.
			//
			//	dataObject:
			//		The JS data object containing the raw data to convert into item format.
			//
			// 	returns: array
			//		Array of items in store item format.

			var items = dataObject.items || [dataObject];
					
			this._features['dojo.data.api.Identity'] = this._identifier;

			if (this._arrayOfTopLevelItems.length === 0) {
				var item,	i;

				this._arrayOfTopLevelItems	= items;
				this._arrayOfAllItems 		  = [];
				this._itemsByIdentity 			= {};

				for(i = 0; i < this._arrayOfTopLevelItems.length; ++i) {
					item = this._arrayOfTopLevelItems[i];

					item[this._rootItemPropName] = true;
					this._newItem( item, null );
					this._updateChildren(item);
				}
			}
			else // Store already loaded, go update instead.
			{
				var identity;

				for(i=0; i<items.length; i++) {
					identity = items[i][this._identifier];
					item = this._getItemByIdentity( identity );
					if (item) {
						this._updateItem(item, items[i]);
					} else {
						throw new Error(this.moduleName+"::_uploadDataToStore: Item not found in store.");
					}
				}
			}
		},

		close: function (/*dojo.data.api.Request || keywordArgs || null */ request) {
			 //	summary:
			 //		See dojo.data.api.Read.close()
			 if (this.clearOnClose && this._loadFinished && !this._loadInProgress) {
				 //Reset all internalsback to default state.  This will force a reload
				 //on next fetch.  This also checks that the data or url param was set
				 //so that the store knows it can get data.  Without one of those being set,
				 //the next fetch will trigger an error.
				 if ((this.url == "" || this.url == null)) {
					 console.debug(this.moduleName+"::close: WARNING!  Data reload " +
						" information has not been provided." +
						"  Please set 'url' or 'data' to the appropriate value before" +
						" the next fetch");
				 }
				 this._arrayOfAllItems = [];
				 this._arrayOfTopLevelItems = [];
				 this._loadFinished = false;
				 this._loadInProgress = false;
				 this._queuedFetches = [];
			 }
		},

		containsValue: function (/*item*/ item,	/*String*/ attribute, /*anything*/ value) {
			//	summary:
			//		See dojo.data.api.Read.containsValue()
			var regexp = undefined;
			if (typeof value === "string") {
				regexp = filterUtil.patternToRegExp(value, false);
			}
			return this._containsValue(item, attribute, value, regexp); //boolean.
		},

		fetch: function (	/*Object*/ keywordArgs) {
			//	summary:
			//		See dojo.data.util.simpleFetch.fetch()
			var scope = keywordArgs.scope || window.global;
			var self  = this;

			if (this._loadFinished) {
				this._fetchComplete(keywordArgs, this._getItemsArray(keywordArgs.queryOptions));
			} else {
				//If fetches come in before the loading has finished, but while
				//a load is in progress, we have to defer the fetching to be
				//invoked in the callback.
				if (this._loadInProgress) {
					this._queuedFetches.push({args: keywordArgs, func: this.fetch, scope: self});
				}else{
					this._loadInProgress = true;
					var getArgs    = this._requestToArgs( keywordArgs );
					var getHandler = xhr.get(getArgs);
					getHandler.addCallback(function (data) {
						try{
							self._uploadDataToStore(data, false);
							self._loadFinished = true;
							self._loadInProgress = false;
							self._fetchComplete(keywordArgs, self._getItemsArray(keywordArgs.queryOptions));
							self._handleQueuedFetches();
						} catch(error) {
							self._loadInProgress = false;
							if (keywordArgs.onError) {
								keywordArgs.onError.call(scope, error);
							} else {
								console.error(error);
							}
						}
					});
					getHandler.addErrback(function (error) {
						self._loadInProgress = false;
						if (keywordArgs.onError) {
							var scope = keywordArgs.scope ? keywordArgs.scope : window.global;
							keywordArgs.onError.call(scope, error);
						} else {
							console.error(error);
						}
					});
				}
			}
		},

		fetchItemByIdentity: function (/* Object */ keywordArgs) {
			//	summary:
			//		See dojo.data.api.Identity.fetchItemByIdentity()
			var path = keywordArgs.identity;
			var self = this;
			var item,
					scope;

			if (this.cache && this._loadFinished) {
				item = this._getItemByIdentity(keywordArgs.identity);
				if (keywordArgs.onItem) {
					scope = keywordArgs.scope ? keywordArgs.scope : window.global;
					keywordArgs.onItem.call(scope, item);
				}
				return;
			}
			
			if (this._loadInProgress) {
				this._queuedFetches.push({args: keywordArgs, func: this.fetchItemByIdentity, scope: self});
			} else {
				this._loadInProgress = true;
				var request    = { path: path };
				var getArgs    = this._requestToArgs( request );
				var getHandler = xhr.get(getArgs);
				getHandler.addCallback(function (data) {
					var scope = keywordArgs.scope ? keywordArgs.scope : window.global;
					try{
						self._uploadDataToStore(data);
						self._loadFinished = true;
						self._loadInProgress = false;
						item = self._getItemByIdentity(keywordArgs.identity);
						if (keywordArgs.onItem) {
							keywordArgs.onItem.call(scope, item);
						}
						self._handleQueuedFetches();
					}catch(error) {
						self._loadInProgress = false;
						if (keywordArgs.onError) {
							keywordArgs.onError.call(scope, error);
						}
					}
				});
				getHandler.addErrback(function (error) {
					self._loadInProgress = false;
					if (keywordArgs.onError) {
						var scope = keywordArgs.scope ? keywordArgs.scope : window.global;
						keywordArgs.onError.call(scope, error);
					} else {
						console.error(error);
					}
				});
			}
		},

		getAttributes: function (/*item*/ item) {
			//	summary:
			//		See dojo.data.api.Read.getAttributes()
			this._assertIsItem(item);
			var attributes = [];
			for(var key in item){
				// Save off only the real item attributes, not the internal specials
				if((key !== this._storeRefPropName) && (key !== this._rootItemPropName) && (key !== this._reverseRefMap)){
					attributes.push(key);
				}
			}
			return attributes; // Array
		},

		getFeatures: function () {
			//	summary:
			//		See dojo.data.api.Read.getFeatures()
			return this._features; //Object
		},

		getLabel: function (/*item*/ item) {
			//	summary:
			//		See dojo.data.api.Read.getLabel()
			if (this._labelAttr && this.isItem(item)) {
				return this.getValue(item,this._labelAttr); //String
			}
			return undefined; //undefined
		},

		getLabelAttr: function () {
			// summary:
			//		Return the label attribute of the store.
			// tag:
			//		public

			return this._labelAttr;
		},

		getLabelAttributes: function (/*item*/ item) {
			//	summary:
			//		See dojo.data.api.Read.getLabelAttributes()
			if (this._labelAttr) {
				return [this._labelAttr]; //array
			}
			return null; //null
		},

		getIdentity: function (/*item*/ item) {
			//	summary:
			//		See dojo.data.api.Identity.getIdentity()

			this._assertIsItem(item);
			var identity = item[this._identifier];
			return identity ? identity : null;
		},

		getIdentityAttributes: function (/*item*/ item) {
			//	summary:
			//		See dojo.data.api.Identity.getIdentityAttributes()

			return [this._identifier]; // Array
		},

		getParents: function (/*item*/ item) {
			// summary:
			//		Get the parent(s) of a dojo.data.item.	
			// description:
			//		Get the parent(s) of a dojo.data item.	Either the '_reverseRefMap' or
			//		'backup_reverseRefMap' property is used to fetch the parent(s). In the
			//		latter case the item is pending deletion.
			// storeItem:
			//		The dojo.data.item whose parent(s) will be returned.
			// tags:
			//		private

			if (item) {
				return item[this._reverseRefMap] || [];
			}
		},

		getValue: function (	/*item*/ item, /*String*/ attribute,	/* value? */ defaultValue) {
			//	summary:
			//		See dojo.data.api.Read.getValue()
			var value = item[attribute];
			return (value !== undefined) ? value : defaultValue;
		},

		getValues: function (/*item*/ item,	/*String*/ attribute) {
			//	summary:
			//		See dojo.data.api.Read.getValues()
			var result = [];

			this._assertIsItem(item);
			this._assertIsAttribute(attribute);

			if (item[attribute] !== undefined) {
				result = lang.isArray(item[attribute]) ? item[attribute] : [item[attribute]];
			}
			return result.slice(0);
		},

		hasAttribute: function (	/*item*/ item, /*String*/ attribute) {
			//	summary:
			//		See dojo.data.api.Read.hasAttribute()
			this._assertIsItem(item);
			this._assertIsAttribute(attribute);
			return (attribute in item);
		},

		isItem: function (/*anything*/ something) {
			//	summary:
			//		See dojo.data.api.Read.isItem()
			if (something && something[this._storeRefPropName] === this) {
				return true;
			}
			return false; // Boolean
		},

		isItemLoaded: function (/*item*/ item) {
			 //	summary:
			 //      See dojo.data.api.Read.isItemLoaded()
			var loaded = this.isItem(item);
			if (loaded && typeof item._loaded == "boolean" && !item._loaded) {
				loaded = false;
			}
			return loaded;
		},

		isValidated: function () {
			return this._validated;
		},

		loadItem: function (keywordArgs) {
			var queryOptions = keywordArgs.queryOptions || null;
			var sortFields	 = keywordArgs.sortFields || null;
			var item = keywordArgs.item;
			var self = this;
			var scope = keywordArgs.scope || window.global;
			
			if (this.cache && this.isItemLoaded(item)) { 
				if (keywordArgs.onItem) {
					keywordArgs.onItem.call(scope, item);
				}
			};

			if (this._loadInProgress) {
				this._queuedFetches.push({args: keywordArgs, func: this.loadItem, scope: self});
			} else {
				this._loadInProgress = true;
				var request    = { path: item.path, queryOptions: queryOptions, sortFields: sortFields };
				var getArgs    = this._requestToArgs( request );
				var getHandler = xhr.get(getArgs);
				getHandler.addCallback(function (data) {
					try{
						self._uploadDataToStore(data);
						self._loadFinished = true;
						self._loadInProgress = false;
						self._handleQueuedFetches();

						if (keywordArgs.onItem) {
							keywordArgs.onItem.call(scope, item);
						}

					}catch(e) {
						self._loadFinished = true;
						self._loadInProgress = false;
						if (keywordArgs.onError) {
							keywordArgs.onError(e);
						}
						throw e;
					}
				});
				getHandler.addErrback(function (error) {
					throw error;
				});
			}
		},

		loadStore: function (/*Object?*/ query, /*object?*/ fetchArgs ) {
			// summary:
			//		Try a forced synchronous load of the store but only if it has not
			//		already been loaded.
			//
			if (fetchArgs && fetchArgs.queryOptions) {
				lang.mixin( fetchArgs.queryOptions, { loadAll:true } );
			} else {
				fetchArgs.queryOptions = { loadAll:true };
			}
			if (!this._loadFinished) {
				var request = lang.mixin( { query: query || null }, fetchArgs );
				try {
					this.fetch( request );
				} catch(err) {
					console.error(err);
					return false;
				}
			}
			return true;
		},

		set: function (/*String*/ attribute, /*anytype*/ value) {
			// summary:
			//		Provide the setter capabilities for the store.
			// attribute:
			//		Name of property to set
			// tag:
			//		public
			if (lang.isString(attribute)) {
				var cc = attribute.replace(/^[a-z]|-[a-zA-Z]/g, function (c) { return c.charAt(c.length-1).toUpperCase(); });
				var setter = "_set" + cc + "Attr";

				if  (lang.isFunction(this[setter])) {
					return this[setter](value);
				} else {
					if (this[attribute] !== undefined) {
						this[attribute] = value;
						return this[attribute];
					}
				}
			}
			throw new Error(this.moduleName+"::set(): Invalid attribute");
		},

		setValidated: function ( value ) {
			this._validated = Boolean(value);
		},

		setValue: function ( item, attribute, newValue ) {
			// Check for valid arguments
			this._assertIsItem(item);
			this._assert(lang.isString(attribute));
			this._assert(typeof newValue !== "undefined");

			var oldValue = item[attribute];
			
			item[attribute] = newValue;

			this.onSet(item, attribute, oldValue, newValue);
		},

		onDelete: function (/*item*/ deletedItem) {
			// summary: See dojo.data.api.Notification.onDelete()

			// No need to do anything. This method is here just so that the
			// client code can connect observers to it.
		},

		onRoot: function (/*item*/ item, /*Object*/ evt ) {
			// summary:
			//		Invoked whenever a item is added to, or removed from the root.
			// item:
			//		Store item.
			// evt:
			//		Event object with two properties: 
			//				{ attach: /*boolean*/, 
			//					detach: /*boolean*/ 
			//				}
			// tag:
			//		callback.
		},
		
		onSet: function (/*item*/ item,	/*attribute*/ attribute, /*object|array*/ oldValue, /*object|array*/ newValue) {
			// summary: See dojo.data.api.Notification.onSet()

			// No need to do anything. This method is here just so that the
			// client code can connect observers to it.
		}


	});
	return cbtreeFileStore;
});
