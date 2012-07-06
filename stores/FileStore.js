//
// Copyright (c) 2010-2012, Peter Jekel
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
define(["dojo/_base/array", 
				"dojo/_base/declare", 
				"dojo/_base/json",
				"dojo/_base/lang", 
				"dojo/_base/window", 
				"dojo/_base/xhr",
				"dojo/data/util/filter",
				"dojo/data/util/sorter",
				"dojo/Evented" 
], function ( array, declare, json, lang, window, xhr, filterUtil, sorter, Evented) {
	// module:
	//		cbtree/store/FileStore
	// summary:
	//		The cbtree FileStore is based on the itemFileWriteStore in that it builds
	//		an in memory store to allow applications to add additional attributes to
	//		items not provided by the server side application such as a checked state.
	//		The FileStore however, is dynamic in nature, items may be added, removed
	//		or change based on the responses received from the server side. In addition,
	//		the FileStore fully supports lazy loading.
	//
	//		Store restrictions:
	//
	//			- No store items can be added or deleted programmatically.
	//			- All data contained in the store is considered static with the exception
	//				of custom attributes. As a result, setValue() is only allowed on custom
	//				attributes.
	//			- A subset of the generic StoreModel-API is supported (adding and deleting
	//				store items in not supported).
	
	var FileStore = declare([Evented],{
		constructor: function (/*Object*/ args) {
			// summary: constructor
			//	args: {url: String, cache: Boolean, options: Array, basePath: String}

			this._arrayOfAllItems = [];
			this._arrayOfTopLevelItems = [];
			this._itemsByIdentity = null;

			this._features = {'dojo.data.api.Read':true, 
												'dojo.data.api.Write':true,
												'dojo.data.api.Identity':true,
												'dojo.data.api.Notification': true };
												
			this._storeRefPropName = "_S";   // Default name for the store reference to attach to every item.
			this._rootItemPropName = "_RI";  // Default Item Id for isItem to attach to every item.
			this._reverseRefMap    = "_RRM"; // Default attribute for constructing a reverse reference map.
			this._itemLoaded       = "_IL";  // indicates if the item is loaded.
			this._itemExpanded     = "_EX";  // Indicates if a directory item is fully expanded.
			this._loadInProgress   = false; // Indicates if a load request is in progress.
			this._loadFinished     = false; // Indicates if the initial load request has completed.
			this._queuedFetches    = [];
			this._privateAttrs     = [ this._storeRefPropName, this._rootItemPropName, this._reverseRefMap, 
															    this._itemLoaded, this._itemExpanded ];
			this._readOnlyAttrs    = ["name", "path", "size", "modified", "directory", this.childrenAttr];

			for( var prop in args ) {
				this.set(prop, args[prop]);
			}
		},

		//==============================
		// Parameters to constructor

		// basePath: String
		//		The basePath parameter is a URI reference (rfc 3986) relative to the server's
		//		document root used to compose the root directory.
		basePath: null,

		// cache: Boolean
		cache: false,
		 
		// childrenAttr: String
		//		The attribute name (attribute in the raw server item) that specify that item's
		// 		children
		childrenAttr: "children",

		// clearOnClose: Boolean
		//		Parameter to allow users to specify if a close call should force a reload or not.
		//		By default, it retains the old behavior of not clearing if close is called.  But
		//		if set true, the store will be reset to default state.  Note that by doing this,
		//		all item handles will become invalid and a new fetch must be issued.
		clearOnClose: false,

		// failOk: Boolean
		//		Parameter for specifying that it is OK for the xhrGet call to fail silently.
		failOk: false,

		// options: String[]
		options: [],

		// url: String
		//		The URL of the server side application serving the cbtreeFileStore.
		url: "",

		// urlPreventCache: Boolean
		//		Parameter to allow specifying if preventCache should be passed to the xhrGet call
		// 		or not when loading data from a url. Note this does not mean the store calls the
		// 		server on each fetch, only that the data load has preventCache set as an option.
		// 		Added for tracker: #6072
		urlPreventCache: false,

		// End Parameters to constructor
		//==============================
		
		moduleName: "cbTree/store/FileStore",

		// _identifier:	[private] String
		//		The default identifier property of the store items. This property can be
		//		overwritten by the initial server response.
		_identifier: "path",
		
		// _labelAttr: [private] String
		//		The default label property of the store items. This property can be overwritten
		//		by the initial server response.
		_labelAttr: "name",
			
		// _validated: [private] Boolean
		//		Indicates if the store has been validated. This property has no real
		//		value to the store itself but is used by the model(s) operating on
		//		the store. It is as a shared variable amongst models.
		_validated: false,
		
		_assert: function (/* boolean */ condition) {
			if (!condition) {
				throw new Error(this.moduleName+"::_assert: assertion failed.");
			}
		},

		_assertIsItem: function (/*item*/ item) {
			// summary:
			//		This function tests whether the item passed in is indeed an item in the store.
			//	item:
			//		The item to test for being contained by the store.
			//	tags:
			//		private
			if (!this.isItem(item)) {
				throw new Error(this.moduleName+"::_assertIsItem: Invalid item argument.");
			}
		},

		_assertIsAttribute: function (/*String */ attribute) {
			// summary:
			//		This function tests whether the item passed in is indeed a valid 'attribute'
			//		like type for the store.
			//	attribute:
			//		The attribute to test for being contained by the store.
			//	tags:
			//		private
			if (typeof attribute !== "string") {
				throw new Error(this.moduleName+"::_assertIsAttribute: Invalid attribute argument.");
			}
		},

		_assertNoSupport: function (/*string*/ name ) {
			// summary:
			//		Throw an error if an unsupported function is called. See the common store
			//		model API cbtree/models/StoreModel-API and cbtree/models/ItemWriteStoreEX
			//		for details.
			throw new Error(this.moduleName+"::"+name+": Function not supported on a file store.");
		},
		
		_containsValue: function (	/*item*/ item, /*String*/ attribute, /*anything*/ value,/*RegExp?*/ regexp) {
			// summary:
			//		Internal function for looking at the values contained by the item.
			//		This function allows for denoting if the comparison should be case
			//		sensitive for strings or not.
			//
			// item:
			//		The data item to examine for attribute values.
			// attribute:
			//		The attribute to inspect.
			// value:
			//		The value to match.
			// regexp:
			//		Optional regular expression generated off value if value is of type string
			//		to handle wildcarding. If present and attribute values are string, then it
			//		can be used for comparison instead of 'value'
			// tags:
			//		private
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

		_deleteItem: function ( /*item*/ item ) {
			// summary:
			//		Delete an item from the store. This is a function internal to the store, no public 
			//		methods are available to programmatically delete store items.
			// item:
			//		Valid store item to be deleted.
			// tags:
			//		private
			if (item.directory) {
				var children = item[this.childrenAttr],
						i;
				if (children.length > 0) {
					for (i in children) {
						this._deleteItem( children[i] );
					}
				}
				item[this.childrenAttr] = [];
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
		
		_fetchComplete: function (/*Object*/requestArgs, /*array*/arrayOfItems) {
			// summary:
			//		On completion of a fetch() call the appropriate callback functions if
			//		specified in the request arguments.
			// requestArgs:
			// arrayOfItems:
			//		Array of store items that matched the fetch() criteria which may be
			//		zero. Note, the array is a local copy of the data as we don't want
			//		the caller to alter the store content.
			// tags:
			//		private
			var scope   = requestArgs.scope || window.global;
			var aborted = false;
			var	i;

			if (requestArgs.onBegin) {
				requestArgs.onBegin.call(scope, arrayOfItems.length, requestArgs);
			}
			if (requestArgs.onItem) {
				for (i in arrayOfItems) {
					var item = arrayOfItems[i];
					if (!aborted) {
						requestArgs.onItem.call(scope, item, requestArgs);
					}
				}
			}
			if (requestArgs.onComplete) {
				requestArgs.onComplete.call(scope, (!requestArgs.onItem ? arrayOfItems : null), requestArgs);
			}
		},

		_fetchFromStore: function (/*Object*/requestArgs, /*array*/arrayOfItems) {
			// summary:
			//		Once the store is established, that is, after the first fetch() response from
			//		the sever has been processed (_loadFinished=true) all subsequent queries are
			//		performed on the in memory store. This to avoid that additional queries change
			//		the view of the in memory store. If a new top level view is required the caller
			//		must close the store first and issue a new fetch() assuming the store property
			//		clearOnClose is set. (see close() for more details).
			// requestArgs:
			// arrayOfItems:
			// tags:
			//		private
			var scope = requestArgs.scope || window.global;

			if (requestArgs.query) {
				var items = [],
						ignoreCase,
						value,
						key,
						i;

				ignoreCase = requestArgs.queryOptions ? requestArgs.queryOptions.ignoreCase : false;

				//See if there are any string values that can be regexp parsed first to avoid multiple regexp gens on the
				//same value for each item examined.  Much more efficient.
				var regexpList = {};
				for(key in requestArgs.query){
					value = requestArgs.query[key];
					if(typeof value === "string"){
						regexpList[key] = filterUtil.patternToRegExp(value, ignoreCase);
					}else if(value instanceof RegExp){
						regexpList[key] = value;
					}
				}
				for (i in arrayOfItems) {
					var item  = arrayOfItems[i];
					var match = true;

					for(key in requestArgs.query){
						value = requestArgs.query[key];
						if(!this._containsValue(item, key, value, regexpList[key])){
							match = false;
							break;
						}
					}
					if(match){
						items.push(item);
					}
				}
			} 
			else 
			{
				items = arrayOfItems.slice(0);
			}
			if(items.length && requestArgs.sort){
				items.sort(sorter.createSortFunction(requestArgs.sort, this));
			}
			this._fetchComplete( requestArgs, items );
		},
		
		_getItemByIdentity: function (/*Object*/ identity) {
			// summary:
			//		Internal function to look an item up by its identity map.
			//	identity:
			//	tags:
			//		private
			var item = null;
			if (this._itemsByIdentity) {
				if (Object.hasOwnProperty.call(this._itemsByIdentity, identity)) {
					item = this._itemsByIdentity[identity];
				}
			}
			return item; // Object
		},

		_getItemsArray: function (/*object?*/ queryOptions) {
			// summary:
			//		Internal function to determine which list of items to search over.
			//	queryOptions:
			//		The query options parameter, if any.
			//	tags:
			//		private
			if (queryOptions && queryOptions.deep) {
				return this._arrayOfAllItems;
			}
			return this._arrayOfTopLevelItems;
		},

		_handleQueuedFetches: function () {
			// summary:
			//		Internal function to execute delayed request in the store.
			//		Execute any deferred fetches now.
			// tags:
			//		private
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

		_isMemberOf: function (/*item*/ child, /*item[]*/children) {
			// summary:
			//		Returns the index of child in array children base on the child identity.
			//		If child is not a member of children -1 is returned.
			// child:
			//		The item whose identity to test for being contained by children.
			// children:
			//		Array of store items
			// tags:
			//		private
			var i;
			
			if (children.length > 0) {
				for (i in children) {
					if (child[this._identifier] === children[i][this._identifier]) {
						return i;
					}
				}
			}
			return -1;
		},

		_isPrivateAttr: function (/*string*/attr) {
			// summary:
			//		Returns true is attr is one of the private item attributes.
			// attr:
			//		Attribute name to be tested.
			// tags:
			//		private
			var i;
			
			for(i in this._privateAttrs) {
				if (attr == this._privateAttrs[i]) {
					return true;
				}
			}
			return false;
		},

		_isReadOnlyAttr: function (/*string*/attr) {
			// summary:
			//		Returns true is attr is one of the static item attributes.
			// attr:
			//		Attribute name to be tested.
			// tags:
			//		private
			var i;
			
			for(i in this._readOnlyAttrs) {
				if (attr == this._readOnlyAttrs[i]) {
					return true;
				}
			}
			return false;
		},

		_mergeItems: function (item, rawItem) {
			// summary:
			//		Merge item information received from the server with an existing item
			//		in the in-memory store. If an items properties have changed an onSet()
			//		event is generated for the property.
			// item:
			//		Existing item in the store.
			// rawItem:
			//		Update (raw) item received from the server.
			// tags:
			//		private
			var name, newVal, empty ={};
			
			// Merge regular properties first.
			for (name in rawItem) {
				if (name != this.childrenAttr && name != this._itemExpanded) {
					newVal = rawItem[name];
					if(!(name in item) || (item[name] !== newVal && (!(name in empty) || empty[name] !== newVal))){
						if (item[this._itemLoaded]) {
							// Signal if property value changed.
							this.onSet( item, name, item[name], newVal );
						}
						item[name] = newVal;
					}
				}
			}
			// Merge any children.
			if (rawItem.directory) {
				if (rawItem[this._itemExpanded]) {
					var childItems = rawItem[this.childrenAttr],
							children   = item[this.childrenAttr],
							orgChild,
							child;
							
					item[this.childrenAttr] = [];			// Reset list of current children

					for (i in childItems) {
						child = childItems[i];
						index = this._isMemberOf(child, children);
						if (index === -1) {
							newChild = this._newItem( child, item);
							item[this.childrenAttr].push(newChild);
							newChildren = true;
						} 
						else // A previously known child.
						{
							orgChild = children.splice(index,1)[0];
							item[this.childrenAttr].push(orgChild);
							this._mergeItems( orgChild, child );
						}
					}
					// Signal the children have changed whenever new children have been added
					// or if any children are left on the original childrens list indicating 
					// they no longer exist.
					if (item[this._itemLoaded]) {
						if (children.length !== 0 || newChildren) {
							this.onSet( item, this.childrenAttr, item[this.childrenAttr] );
						}
					}
					if (children.length) {
						while (child = children.shift() ) {
							this._deleteItem( child );
						}
					}
					item[this._itemExpanded] = true;
					item[this._itemLoaded]   = true;
				}
			}
		},

		_newItem: function (/*item*/ item, /*item?*/ parentItem ) {
			// summary:
			//		Add a new item to the store. This is a function internal to the store, no public 
			//		methods are available to programmatically add new items.
			// item:
			//		A valid store data item to be added to the store.
			// parentItem:
			//		The parent item of item. (optional)
			// tags:
			//		private
			var identity = item[this._identifier];
			
			item[this._storeRefPropName] = this;
			if (parentItem) {
				item[this._reverseRefMap] = [parentItem];
			}
			if (this._itemsByIdentity) {
				if (!Object.hasOwnProperty.call(this._itemsByIdentity, identity)) {
					this._itemsByIdentity[identity] = item;
				}else{
					throw new Error(this.moduleName+"::_newItem: duplicate identity detected: '" +identity+"'" );
				}
			}
			// Explicitly set the directory property so sorting on this property returns
			// the correct results.
			item.directory = item.directory ? true : false;
			item[this._itemLoaded] = item.directory ? item[this._itemExpanded] : true;

			// If item is a directory and is fully expanded we need to add each child as a
			// new store item as well.
			if (item.directory && item[this._itemLoaded]) {
				var children = item[this.childrenAttr];
				var child;
				var i;
				
				item[this.childrenAttr] = [];
				for (i in children) {
					child = this._newItem(children[i], item);
					item[this.childrenAttr].push(child);
				}
			}
			this._arrayOfAllItems.push(item);
			if (parentItem && parentItem[this._itemLoaded]) {
				var parentInfo = { item: parentItem, attribute: this._childrenAttr, oldValue: undefined };
				this.onNew( item, (parentItem ? parentInfo : null) );
			}
			return item;
		},
		
		_removeArrayElement: function (/*Array*/ arrayOfItems, /*anything*/ element) {
			// summary:
			//		Remove an element/item from an array
			// arrayOfItems:
			//		Array which may hold element.
			// element:
			//		The element to be removed.
			// tags:
			//		private
			var index = array.indexOf(arrayOfItems, element);
			if (index != -1) {
				arrayOfItems.splice(index, 1);
				return true;
			}
			return false;
		},

		_requestToArgs: function (/*object*/ request) {
			// summary:
			// request:
			// tags:
			//		private
			var reqParams = {},
					sync = false;

			if (this.basePath) {
				reqParams.basePath = this.basePath;
			}
			if (request.path) {
				reqParams.path = request.path;
			}
			if (request.query) {
				reqParams.query = json.toJson(request.query);
			}
			if (request.sort) {
				reqParams.sort = json.toJson(request.sort);
			}
			if (request.queryOptions) {
				reqParams.queryOptions = json.toJson(request.queryOptions);
			}
			if (request.sync) {
				sync = request.sync;
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
											error: function( error, response ) {
												if (response.xhr) {
													this.status = response.xhr.status;	// Store the HTTP status code.
												}
											},
											failOk: this.failOk,
											sync: sync }

			return getArgs;
		},

		_setOptionsAttr: function (value) {
			// summary:
			// value:
			// tags:
			//		private
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

		_uploadDataToStore: function (/*Object*/ dataObject ) {
			// summary:
			//		Function to parse the loaded data into item format and build the internal
			//		items array. After the initial server response is processed all subsequent
			//		responses are used to update the existing store.
			// dataObject:
			//		The JS data object containing the raw data to convert into item format.
			// returns:
			//		An array of store items.
			
			var rawItems = dataObject.items,
					childItems,
					items 	 = [],
					item, i,
					identity;
					
			if (!rawItems) {
				// dataObject has no items property.
				throw new Error(this.moduleName+"::_uploadDataToStore: Malformed server response.");
			}

			if (this._arrayOfTopLevelItems.length === 0) {
				if (dataObject.identifier) {
					this._identifier = dataObject.identifier;
				}
				if (dataObject.label) {
					this._label = dataObject.label;
				}
				this._features['dojo.data.api.Identity'] = this._identifier;
				
				this._arrayOfTopLevelItems	= rawItems;
				this._arrayOfAllItems 			= [];
				this._itemsByIdentity 			= {};

				for (i in this._arrayOfTopLevelItems) {
					item = this._arrayOfTopLevelItems[i];

					item[this._rootItemPropName] = true;
					this._newItem( item, null );
					items.push(item);
				}
				this.onLoaded();		// Signal event.
			}
			else // Store already loaded, go update instead.
			{
				for (i in rawItems) {
					identity = rawItems[i][this._identifier];
					item = this._getItemByIdentity( identity );
					if (item) {
						this._mergeItems( item, rawItems[i] );
						items.push(item);
					} else {
						throw new Error(this.moduleName+"::_uploadDataToStore: Item not found in store.");
					}
				}
			}
			return items;
		},

		close: function (/*dojo.data.api.Request || keywordArgs || null */ request) {
			// summary:
			//		See dojo.data.api.Read.close()
			// request:
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
				this._arrayOfTopLevelItems = [];
				this._arrayOfAllItems = [];
				this._queuedFetches = [];
				this._itemsByIdentity = null;

				this._loadFinished = false;
				this._loadInProgress = false;
			}
		},

		containsValue: function (/*item*/ item,	/*String*/ attribute, /*anything*/ value) {
			// summary:
			//		See dojo.data.api.Read.containsValue()
			// item:
			// attribute:
			// value:
			var regexp = undefined;
			if (typeof value === "string") {
				regexp = filterUtil.patternToRegExp(value, false);
			}
			return this._containsValue(item, attribute, value, regexp); //boolean.
		},

		fetch: function (	/*Object*/ keywordArgs) {
			// summary:
			// keywordArgs:
			var scope = keywordArgs.scope || window.global;
			var self  = this;

			if (this._loadFinished) {
				this._fetchFromStore(keywordArgs, this._getItemsArray(keywordArgs.queryOptions));
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
							var items = self._uploadDataToStore(data);
							self._loadFinished   = true;
							self._loadInProgress = false;
							self._fetchComplete(keywordArgs, items);
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
						}
					});
				}
			}
		},

		fetchItemByIdentity: function (/*Object*/ keywordArgs) {
			// summary:
			//		See dojo.data.api.Identity.fetchItemByIdentity()
			var scope = keywordArgs.scope || window.global;
			var path  = keywordArgs.identity || keywordArgs[this._identifier];
			var self  = this;
			var item;

			// Check the store if it's a known item.
			item = this._getItemByIdentity(path);

			if (this.cache && this._loadFinished) {
				if (keywordArgs.onItem) {
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
					try{
						var items = self._uploadDataToStore(data);
						self._loadFinished   = true;
						self._loadInProgress = false;
						if (items.length && keywordArgs.onItem) {
							keywordArgs.onItem.call(scope, items[0]);
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
					// Delete item if not found but was previously known.
					if( getArgs.status == 404 && item ) {
						self._deleteItem( item );
					}
					if (keywordArgs.onError) {
						keywordArgs.onError.call(scope, error);
					}
				});
			}
		},

		getAttributes: function (/*item*/ item) {
			// summary:
			//		See dojo.data.api.Read.getAttributes()
			this._assertIsItem(item);
			var attributes = [];
			for(var key in item){
				// Save off only the real item attributes, not the internal specials
				if ( !this._isPrivateAttr(key)) {
					attributes.push(key);
				}
			}
			return attributes; // Array
		},

		getFeatures: function () {
			// summary:
			//		See dojo.data.api.Read.getFeatures()
			return this._features; //Object
		},

		getIdentity: function (/*item*/ item) {
			// summary:
			//		See dojo.data.api.Identity.getIdentity()

			var identifier = this._features['dojo.data.api.Identity'];
			var identity   = item[identifier];
			return identity ? identity : null;
		},

		getIdentifierAttr: function() {
			// summary:
			//		Returns the store identifier attribute if defined.
			// tag:
			//		public
			return this._identifier;
		},

		getIdentityAttributes: function (/*item*/ item) {
			// summary:
			//		See dojo.data.api.Identity.getIdentityAttributes()
			// tag:
			//		public
			return [this._identifier]; // Array
		},

		getLabel: function (/*item*/ item) {
			// summary:
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
			return (this._labelAttr || null);
		},

		getLabelAttributes: function (/*item*/ item) {
			// summary:
			//		See dojo.data.api.Read.getLabelAttributes()
			return (this._labelAttr ? [this._labelAttr] : null);
		},

		getParents: function (/*item*/ item) {
			// summary:
			//		Get the parent(s) of a item.	
			// description:
			//		Get the parent(s) of a FileStore item.	The '_reverseRefMap' property
			//		is used to fetch the parent(s).
			// storeItem:
			//		The item whose parent(s) will be returned.

			if (item) {
				return item[this._reverseRefMap] || [];
			}
		},

		getValue: function (	/*item*/ item, /*String*/ attribute,	/* value? */ defaultValue) {
			// summary:
			//		See dojo.data.api.Read.getValue()
			var value = item[attribute];
			return (value !== undefined) ? value : defaultValue;
		},

		getValues: function (/*item*/ item,	/*String*/ attribute) {
			// summary:
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
			// summary:
			//		See dojo.data.api.Read.hasAttribute()
			this._assertIsItem(item);
			this._assertIsAttribute(attribute);
			return (attribute in item);
		},

		isItem: function (/*anything*/ something) {
			// summary:
			//		See dojo.data.api.Read.isItem()
			if (something && something[this._storeRefPropName] === this) {
				return true;
			}
			return false; // Boolean
		},

		isItemLoaded: function (/*item*/ item) {
			 // summary:
			 //      See dojo.data.api.Read.isItemLoaded()
			var loaded = this.isItem(item);

			if (this.isItem(item)) {
				if (item.directory && !item[this._itemExpanded]) {
					loaded = false;
				}
			}
			return loaded;
		},

		isRootItem: function (/*item*/ item) {
			// summary:
			//		Returns true if the item has the '_rootItemPropName' property defined
			//		and its value is true, otherwise false is returned.
			// item:
			//		A valid dojo.data.store item.
			// returns:
			//		True if the item is a root item otherwise false
			// tag:
			//		public

			this._assertIsItem(item);
			return item[this._rootItemPropName] ? true : false; 
		},

		isValidated: function () {
			return this._validated;
		},

		loadItem: function (keywordArgs) {
			// summary:
			var queryOptions = keywordArgs.queryOptions || null;
			var scope 			 = keywordArgs.scope || window.global;
			var sort	 			 = keywordArgs.sort || null;
			var item = keywordArgs.item;
			var self = this;
			
			if (this.isItemLoaded(item)) {
				if (this.cache) {
					if (keywordArgs.onItem) {
						keywordArgs.onItem.call(scope, item);
					}
					return;
				}
			}

			if (this._loadInProgress) {
				this._queuedFetches.push({args: keywordArgs, func: this.loadItem, scope: self});
			} else {
				this._loadInProgress = true;
				var request    = { path: item.path, queryOptions: queryOptions, sort: sort };
				var getArgs    = this._requestToArgs( request );
				var getHandler = xhr.get(getArgs);
				getHandler.addCallback(function (data) {
					try{
						var items = self._uploadDataToStore(data);
						self._loadFinished   = true;
						self._loadInProgress = false;
						self._handleQueuedFetches();

						if (items.length && keywordArgs.onItem) {
							keywordArgs.onItem.call(scope, items[0]);
						}

					}catch(error) {
						self._loadInProgress = false;
						if (keywordArgs.onError) {
							keywordArgs.onError(error);
						}
						throw error;
					}
				});
				getHandler.addErrback(function (error) {
					self._loadInProgress = false;
					// Delete item if not found but was previously known.
					if( getArgs.status == 404 && item ) {
						self._deleteItem( item );
					}
					if (keywordArgs.onError) {
						keywordArgs.onError.call(scope, error);
					}
				});
			}
		},

		loadStore: function (/*Object?*/ query, /*object?*/ fetchArgs ) {
			// summary:
			//		Try a forced synchronous load of the store but only if it has not
			//		already been loaded.
			//
			if (fetchArgs) {
				if (fetchArgs.queryOptions) {
					lang.mixin( fetchArgs.queryOptions, { loadAll:true } );
				} else {
					fetchArgs.queryOptions = { loadAll:true };
				}
			} else {
				fetchArgs = null;
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
			//		Provide the setter capabilities for the store similar to dijit widgets.
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
			throw new Error(this.moduleName+"::set: Invalid attribute");
		},

		setValidated: function (/*Boolean*/ value) {
			// summary:
			//		Mark the store as successfully been validated.
			this._validated = Boolean(value);
		},
		
		setValue: function ( item, attribute, newValue ) {
			// summary:
			//		Set a new attribute value. 
			var oldValue;
			var	i;
			
			this._assertIsItem(item);
			this._assert(lang.isString(attribute));
			this._assert(typeof newValue !== "undefined");

			for (i in this._readOnlyAttrs) {
				if (this._isReadOnlyAttr(attribute) || this._isPrivateAttr(attribute)) {
					throw new Error(this.moduleName+"::setValue: attribute ["+attribute+"] is private or read-only");
				}
			}
			oldValue = item[attribute];
			item[attribute] = newValue;

			this.onSet(item, attribute, oldValue, newValue);
			return true;
		},

		// =======================================================================
		//	Event hooks.
		onDelete: function (/*item*/ deletedItem) {
			// summary: See dojo.data.api.Notification.onDelete()
		},

		onLoaded: function () {
			// summary:
			//		Invoked when loading the store completes.
			// tag:
			//		callback.
		},
		
		onNew: function(/* item */ newItem, /*object?*/ parentInfo){
			// summary: See dojo.data.api.Notification.onNew()

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
		},

		// =======================================================================
		// Implement the supported Store Model API extensions.

		addReference: function() {
			this._assertNoSupport( "addReference" );
		},
		
		attachToRoot: function() {
			this._assertNoSupport( "AttachToRoot" );
		},
		
		detachFromRoot: function() {
			this._assertNoSupport( "detachFromRoot" );
		},
		
		deleteItem: function() {
			this._assertNoSupport( "deleteItem" );
		},
		
		itemExist: function (/*Object*/ keywordArgs) {
			// summary:
			//		Tests if, and return a store item if it exists.
			// keywordArgs:
			//		Object defining the store item properties.
			// returns:
			//		The item if is exist
			// tag:
			//		public
			var	itemIdentity,
					item;
			
			if (typeof keywordArgs != "object" && typeof keywordArgs != "undefined"){
				throw new Error(this.moduleName+"::itemExist: argument is not an object.");
			}
			if (this._itemsByIdentity) {
				itemIdentity = keywordArgs[this._identifier];
				if (typeof itemIdentity === "undefined"){
					throw new Error(this.moduleName+"::itemExist: Item has no identity.");
				}
				item = this._itemsByIdentity[itemIdentity];
			}
			return item;
		},

		newItem: function() {
			this._assertNoSupport( "newItem" );
		},
		
		removeReference: function() {
			this._assertNoSupport( "removeReference" );
		}
		
	});
	return FileStore;
});
