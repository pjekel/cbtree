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
				"dojo/Evented",
				"./util/sorter"
], function ( array, declare, json, lang, window, xhr, filterUtil, Evented, sorter ) {
	// module:
	//		cbtree/stores/FileStore
	// summary:
	//		The cbtree FileStore implements the dojo/data/api/Read API and parts of the
	//		dojo/data/api/Write API.   The partial write API allows applications to add
	//		custom attributes to items not provided by the server side application such
	//		as a checked state. The in-memory FileStore is dynamic in that items may be
	//		added, removed or change based on the responses  received from the back-end
	//		server. In addition, the FileStore fully supports lazy loading.
	//
	//		Store restrictions:
	//
	//			- Items can be deleted BUT no store items can be added programmatically.
	//			- All data contained in the store is considered 'read-only' with the
	//				exception of custom attributes, therefore setValue() is only allowed
	//				on custom attributes.
	//			- Custom attributes are not passed to the back-end server.
	//			- A subset of the generic StoreModel-API is supported.
	//
	//		Server Side Application:
	//
	//			Currently two implementations of the Server Side Application are available:
	//
	//				cbtree/stores/server/PHP/cbtreeFileStore.php
	//				cbtree/stores/server/CGI/bin/cbtreeFileStore.cgi
	//
	//			Please refer to the File Store documentation for details on the Server Side
	//			Application. (cbtree/documentation/FileStore.md)
	
	var FileStore = declare([Evented],{
		constructor: function (/*Object*/ args) {
			// summary: 
			//		File Store constructor.
			//	args: { url: String, 
			//				  cache: Boolean, 
			//					options: String[], 
			//					basePath: String,
			//					urlPreventCache: Boolean,
			//					failOk: Boolean,
			//					childrenAttr: String,
			//					clearOnClose: Boolean
			//				}

			this._arrayOfAllItems = [];
			this._arrayOfTopLevelItems = [];
			this._itemsByIdentity = null;

			this._features = { 'dojo.data.api.Read':true, 
												 'dojo.data.api.Write':true,
												 'dojo.data.api.Identity':true,
												 'dojo.data.api.Notification': true 
												};
												
			this._storeRefPropName = "_S";   // Default name for the store reference to attach to every item.
			this._rootItemPropName = "_RI";  // Default Item Id for top level store items
			this._reverseRefMap    = "_RRM"; // Default attribute for constructing a reverse reference map.
			this._itemLoaded       = "_IL";  // Default attribute indicating if the item is loaded.
			this._itemExpanded     = "_EX";  // Attribute indicating if a directory item is fully expanded.
			this._loadInProgress   = false; // Indicates if a load request is in progress.
			this._loadFinished     = false; // Indicates if the initial load request has completed.
			this._queuedFetches    = [];     // Pending list of fetch requests.
			this._options          = [];     // Server Side Options
			this._authToken        = null;  // Authentication Token
			this._privateAttrs     = [ this._storeRefPropName, this._rootItemPropName, this._reverseRefMap, 
															    this._itemLoaded, this._itemExpanded ];
			this._readOnlyAttrs    = ["name", "path", "size", "modified", "directory", "icon", this.childrenAttr];

			for( var prop in args ) {
				this.set(prop, args[prop]);
			}
		},

		//==============================
		// Parameters to constructor

		// authToken: Object
		//		An arbitrary JavaScript object that is passed to the back-end server "as is"
		//		and may be used to implement authentication. The Server Side Applications
		//		currently DO NOT authenticate.
		authToken: null,
		
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

		// options: String[] || String
		//		A string of comma separated keywords or an array of keyword string. The keywords
		//		are passed to the server side application and influence the server response.
		//		The following keywords are currently supported: 
		//
		//			dirsOnly				- Return only directory entries.
		//			iconClass				- Include a css icon classname 
		//			showHiddenFiles	- Show hidden files
		//
		options: [],

		// url: String
		//		The URL of the server side application serving the cbtree FileStore.
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

		_addIconClass: false,
		
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
		
		//=========================================================================
		// Private Methods
		
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

		_assertIsAttribute: function (/*String */ attribute, /*string*/ funcName ) {
			// summary:
			//		This function tests whether the item passed in is indeed a valid 'attribute'
			//		like type for the store.
			//	attribute:
			//		The attribute to test for being contained by the store.
			//	tags:
			//		private
			if (typeof attribute !== "string") {
				throw new Error(this.moduleName+"::"+funcName+": Invalid attribute argument.");
			}
		},

		_assertNoSupport: function (/*string*/ name ) {
			// summary:
			//		Throw an error if an unsupported function is called. See the common store
			//		model API cbtree/models/StoreModel-API and cbtree/models/ItemWriteStoreEX
			//		for details.
			throw new Error(this.moduleName+"::"+name+": Function not supported on a File Store.");
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

		_deleteItem: function ( /*item*/ item, /*boolean*/ onSetCall ) {
			// summary:
			//		Delete an item from the store. This function is internal to the store.
			//		This method is called by either _deleteItems() or _mergeItems(). When 
			//		called from _deleteItems() it is the result of a explicitly user call
			//		to the public deleteItem(). If called from _mergeItems() it is because
			//		a change on the server side was detected.
			// item:
			//		Valid store item to be deleted.
			// onSetCall:
			//		Indicate if onSet() should be called.
			// returns:
			//		An array of deleted file store items.
			// tags:
			//		private
			var items = [];
			
			if (item.directory) {
				var children = this.getValues( item, this.childrenAttr ),
						deleted,
						i;
				if (children.length > 0) {
					for (i=0; i<children.length; i++) {
						// Delete the child but suppress any onSet() events because the
						// directory itself will be removed as well.
						deleted = this._deleteItem( children[i], false );
						if (deleted) {
							items = items.concat(deleted);
						}
					}
				}
			}
			// Remove item from the its parent children list.
			var parent = this.getParents(item)[0];
			if (parent) {
				if (onSetCall) {
					var oldValue = this.getValues( parent, this.childrenAttr );
					if (this._removeArrayElement( parent[this.childrenAttr], item )) {
						var newValue = this.getValues( parent, this.childrenAttr );
						this.onSet( parent, this.childrenAttr, oldValue, newValue );
					}
				} else {
					this._removeArrayElement( parent[this.childrenAttr], item );
				}
			} 
			// Remove all item reference from the store.
			item[this._storeRefPropName] = null;
			if (this._itemsByIdentity) {
				var identity = item[this._identifier];
				delete this._itemsByIdentity[identity];
			}
			this._removeArrayElement(this._arrayOfAllItems, item);
			if (item[this._rootItemPropName]) {
				this._removeArrayElement(this._arrayOfTopLevelItems, item);
			}
			this.onDelete(item);
			items.push(item);
			return items;
		},

		_deleteItems: function (/*Object*/ dataObject ) {
			// summary:
			//		Delete the list of items referenced in the dataObject.
			// description:
			//		Delete the list of items referenced in the dataObject. The items in the
			//		dataObject can be in any order. For example, a directory typically appears
			// 		in the list after its children. However, to prevent the method deleteItem()
			//		from generating an onSet() event each time a child is deleted from its
			//		parent directory when eventually the directory itself will be removed, 
			//		the list is sorted first. As a result directory entries will always appear
			//		in the list BEFORE its children. 
			//		Whenever deleteItem() encounters a directory entry, all of its children
			//		are automatically removed WITHOUT generating the onSet() event for each
			//		child.
			// dataObject:
			//		The JavaScript data object containing the files that have successfully
			//		been deleted from the server.
			// returns:
			//		An array of deleted file store items.
			// tags:
			//		private
			var deletedItems = dataObject.items;
			var	storeItem, rawItem;
			var identity;
			var deleted;
			var items = [];
			var i;
			
			if (deletedItems) {
				// Sort the list of deleted item first
				var sortList = new sorter( [{attribute:"path"}] );
				deletedItems.sort( sortList.sortFunction() );

				for (i=0; i<deletedItems.length; i++) {
					rawItem   = deletedItems[i];
					identity  = rawItem[this._identifier];
					storeItem = this._getItemByIdentity(identity);
					// Deleted items may not be available in the store if the deleted item was
					// a directory child and the directory had not been fully loaded or if the
					// parent directory was listed BEFORE its children. Therefore, not finding
					// items in the store is NOT considered an error.
					if (storeItem) {
						deleted = this._deleteItem(storeItem, true);
						items   = items.concat(deleted);
					}
				}
			}
			return items;
		},
		
		_fetchComplete: function (/*Object*/requestArgs, /*array*/arrayOfItems) {
			// summary:
			//		On completion of a fetch(), call the appropriate callback functions if
			//		specified in the request arguments.
			// requestArgs:
			//		See dojo/data/api/Read
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
			//		See dojo/data/api/Read
			// arrayOfItems:
			//		Array of store items to be searched for a match. Depending on the query options
			//		this array represents either _arrayOfAllItems or _arrayOfTopLevelItems
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
			else // No query parameter
			{
				items = arrayOfItems.slice(0);
			}

			if(items.length && requestArgs.sort){
				var sortList = new sorter( requestArgs.sort );
				items.sort( sortList.sortFunction() );
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
//				if (Object.hasOwnProperty.call(this._itemsByIdentity, identity)) {
//					item = this._itemsByIdentity[identity];
//				}
					item = this._itemsByIdentity[identity];
			}
			return item; // Object
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

		_isEmpty: function (something) {
			// summary:
			//		Return true if 'something' is empty otherwise false.
			// something:
			//		Can be almost any data type.
			// tags:
			//		private
			if (typeof something !== "undefined") {
				if (lang.isObject(something)) {
					for(var prop in something) {
						if(something.hasOwnProperty(prop)) {
							return false;
						}
					}
					return true;
				} 
				if (something.hasOwnProperty("length")) {
					return something.length ? false : true;
				}
				return false;
			}
			return true;
		},

		_isPrivateAttr: function (/*string*/attr) {
			// summary:
			//		Returns true is attr is one of the private item attributes.
			// attr:
			//		Attribute name string to be tested.
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
			//		Attribute name string to be tested.
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

		_mergeItems: function (/*item*/ item, /*Object*/ servItem) {
			// summary:
			//		Merge item information received from the server with an existing item
			//		in the in-memory store. If an items properties have changed an onSet()
			//		event is generated for the property.
			// item:
			//		Existing item in the store.
			// servItem:
			//		Update (raw) item received from the server.
			// tags:
			//		private
			var name, newVal, empty ={};
			
			// Merge non-children properties first.
			for (name in servItem) {
				if (name != this.childrenAttr && name != this._itemExpanded) {
					newVal = servItem[name];
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
			if (servItem.directory) {
				if (servItem[this._itemExpanded]) {
					var childItems = servItem[this.childrenAttr];
					var orgChild,	servChild;
					var identity, index;
					var newChildren = false;
					var reOrdered   = false;
					var childOrder  = this.getValues( item, this.childrenAttr );
					var oldValues   = this.getValues( item, this.childrenAttr );
					var newValues   = [];
					var i;
					
					// Check each child, reported by  the server, against the  list of known 
					// children in the store.  On completion newValues will hold the updated
					// list of children whereas oldValues holds the list of deleted children.
					for (i=0; i<childItems.length; i++) {
						servChild = childItems[i];
						identity  = servChild[this._identifier];
						orgChild  = this._getItemByIdentity(identity); 

						index = orgChild ? array.indexOf( childOrder, orgChild ) : -1;
						if (index === -1) {
							newValues.push( this._newItem( servChild, item) );
							newChildren = true;
						} else {
								this._removeArrayElement( oldValues, orgChild );
								newValues.push(orgChild);
								this._mergeItems( orgChild, servChild );
						}
						reOrdered = !reOrdered ? (index != i) : true;
					}
					item[this._itemExpanded] = true;
					item[this._itemLoaded]   = true;

					// Update the items children if, and only if, new children have been added,
					// the sort order changed or existing children have been deleted.
					if (oldValues.length > 0 || newChildren || reOrdered) {
						this._setValues( item, this.childrenAttr, newValues, item[this._itemLoaded] );
					}
					// Delete obsolete children, if any
					if (oldValues.length > 0) {
						while ( (orgChild = oldValues.shift()) ) {
							this._deleteItem( orgChild, true );
						}
					}
				}
			} else {
				item[this._itemExpanded] = true;
				item[this._itemLoaded]   = true;
			}
		},

		_newItem: function (/*item*/ item, /*item?*/ parentItem, /*boolean*/ onSetCall ) {
			// summary:
			//		Add a new item to the store. This is a function internal to the store, no public 
			//		methods are available to programmatically add new items.
			// item:
			//		A valid store data item to be added to the store.
			// parentItem:
			//		The parent item of item. (optional)
			// onSetCall:
			//		Indicated if the callback onSet() will be called on completion.
			// tags:
			//		private
			var identity = item[this._identifier];
			var parentInfo;
			
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
			item[this._itemLoaded] = item.directory ? false : true;

			// If the item is a directory and fully expanded, that is, the server included all
			// children, we need to add each child as a new store item as well.
			if (item.directory && item[this._itemExpanded]) {
				var children = item[this.childrenAttr];
				var i;		
				// Transform all (raw) children to valid store items.
				item[this.childrenAttr] = [];
				for (i =0; i<children.length; i++) {
					this._newItem(children[i], item, false);
				}
				// With all children added, the directory is now considered 'loaded'.
				item[this._itemLoaded] = true;
			} 
			// If there is no parent, the item is a top level entry in the store, otherwise
			// add the item to the parents list of children.
			if (parentItem == null) {
				this._arrayOfTopLevelItems.push(item);
				item[this._rootItemPropName] = true;
			} else {
				parentItem[this.childrenAttr].push(item);
			}
			this._arrayOfAllItems.push(item);
			if (this._addIconClass) {
				this._setIconClass( item );
			}
			if (this._loadFinished && onSetCall) {
				if (parentItem) {
					if (parentItem[this._itemLoaded]) {
						parentInfo = { item: parentItem, attribute: this._childrenAttr, oldValue: undefined };
						this.onNew( item, parentInfo );
					}
				} else {
					this.onNew( item, null );
				}
			}
			return item;
		},
		
		_renameItem: function ( keywordArgs ) {
			//
			var scope = keywordArgs.scope || window.global;
			var item  = keywordArgs.item;
			var self  = this;

			if (this._loadInProgress) {
				this._queuedFetches.push({args: keywordArgs, func: this._renameItem, scope: self});
			} else {
				this._loadInProgress = true;
				var request    = { path: item.path, 
													 attribute: keywordArgs.attribute, 
													 oldValue: keywordArgs.oldValue,
													 newValue: keywordArgs.newValue 
													};
				var getArgs    = this._requestToArgs( "POST", request );
				var getHandler = xhr.post(getArgs);
				getHandler.addCallback(function (data) {
					try{
						var items = self._uploadRenamedItem(data, keywordArgs);

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
					if (keywordArgs.onError) {
						keywordArgs.onError.call(scope, error, getArgs.status);
					}
				});
			}
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

		_requestToArgs: function ( /*string*/ requestType, /*object*/ request) {
			// summary:
			//		Compile the list of XHR GET arguments base on the request object and
			//		File Store options/parameters.
			// requestType:
			//		Type of XHR request (GET, DELETE or POST)
			// request:
			// tags:
			//		private
			var reqParams = {},
					handleAs  = "json",
					getArgs   = null,
					sync = false;

			if (this.basePath) {
				reqParams.basePath = this.basePath;
			}
			if (request.path) {
				reqParams.path = request.path;
			}
			if (this.authToken) {
				reqParams.authToken = json.toJson(this.authToken);
			}
			if (request.sync) {
				sync = request.sync;
			}

			switch( requestType ) {
				case "DELETE":
					break;

				case "GET":
					if (request.query) {
						reqParams.query = json.toJson(request.query);
					}
					if (request.sort) {
						reqParams.sort = json.toJson(request.sort);
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
					break;

				case "POST":
					if (request.attribute) {
						reqParams.attribute = request.attribute;
					}
					if (request.newValue) {
						reqParams.newValue	= request.newValue; 
					}
					if (request.oldValue) {
						reqParams.oldValue	= request.oldValue; 
					}
					break;
			}

			// Create the XHR arguments object. The 'status' property is an extra property
			// which is used during evaluation of the server response.
			getArgs = {	url: this.url,
									handleAs: handleAs,
									content: reqParams,
									preventCache: this.urlPreventCache,
									error: function( error, response ) {
										// In case of an HTTP error, store the status with the arguments.
										if (response.xhr) {
											this.status = response.xhr.status;
										}
									},
									failOk: this.failOk,
									status: 200,	// Assume success. (HTTP OK)
									sync: sync }

			return getArgs;
		},

		_setAuthTokenAttr: function (token) {
			// summary:
			//		Set a custom defined authentication token. The token is passed to the
			//		back-end server "as is".
			// token:
			//		Object, Authentication token
			// tag:
			//		experimental
			if (lang.isObject(token) && !this._isEmpty(token)) {
				this.authToken = token;
			}
			return false;
		},
		
		_setIconClass: function (item ) {
			// summary:
			//		Returns the css icon classname(s) for a store item.
			// item:
			//		A valid file store item.
			// tags:
			//		private
			var last = item.name.lastIndexOf(".");
			var icc;
			var ext;

			if (last > 0) {
				ext = item.name.substr(last+1).toLowerCase();
				ext = ext.replace(/^[a-z]|-[a-zA-Z]/g, function (c) { return c.charAt(c.length-1).toUpperCase(); });
				icc = "fileIcon" + ext;
			} else {
				if (item.directory) {
					icc = "fileIconDIR";
				} else {
					icc = "fileIconUnknown"
				}
			}
			item["icon"] = icc + " fileIcon";
		},
		
		_setOptionsAttr: function (value) {
			// summary:
			//		Hook for the set("options", value) call by the constructor.
			// value:
			//		Comma separated list of keywords or an array of keyword strings.
			// tags:
			//		private
			var i;
			
			if (lang.isArray(value)) {
				this.options = value;
			}else{
				if (lang.isString(value)) {
					this.options = value.split(",");
				} else {
					throw new Error(this.moduleName + "::_setOptionsAttr: Options must be a comma"
																						+ " separated string of keywords"
																						+ " or an array of keyword strings." );
				}
			}
			for(i=0; i<this.options.length;i++) {
				if (this.options[i] === "iconClass") {
					this._addIconClass = true;
				}
			}
			return this.options;
		},

		_setValues: function(/*item*/ item, /*attribute*/ attribute, /*anything*/ newValues, /*boolean*/ onSetCall) {
			//		Set a new attribute value. 
			// item:
			//		A valid File Store item
			// attribute:
			//		Name of item attribute/property to set
			// newValues:
			//		New values to be assigned.
			// tag:
			//		private
			var oldValues;
			var	i;
			
			oldValues = this.getValues(item, attribute);

			if (lang.isArray(newValues)) {
				if (newValues.length === 0 && attribute !== this.childrenAttr) {
					delete item[attribute];
					newValues = undefined;
				} else {
					item[attribute] = newValues.slice(0,newValues.length);
				}
			} else {
				throw new Error(this.moduleName+"::setValues: newValues not an array");
			}
			if (onSetCall) {
				this.onSet(item, attribute, oldValues, newValues);
			}
			return true;
		},

		_uploadDataToStore: function (/*Object*/ dataObject, /*Object*/keywordArgs ) {
			// summary:
			//		Function to parse the server response data into item format and build the
			//		internal items array. After the initial server response is processed all
			//		subsequent responses are used to update the existing store.
			// dataObject:
			//		The JavaScript data object containing the raw data to convert into store 
			//		item format.
			// keywordArgs:
			//		Keyword arguments object of the original request
			// returns:
			//		An array of store items.
			// tag:
			//		private
			var servItems = dataObject.items,
					childItems,
					items 	 = [],
					item, i,
					identity;
					
			if (!servItems) {
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
				
				this._arrayOfTopLevelItems	= [];
				this._arrayOfAllItems 			= [];
				this._itemsByIdentity 			= {};
				// Save the original query and sort
				this._queryOptions				  = keywordArgs.queryOptions;
				this._sort									= keywordArgs.sort;

				for (i=0; i<servItems.length; i++) {
					item = this._newItem( servItems[i], null, true );
					items.push(item);
				}
				this.onLoaded();		// Signal event.
			}
			else // Store already loaded, go update instead.
			{
				for (i=0; i<servItems.length; i++) {
					identity = servItems[i][this._identifier];
					item = this._getItemByIdentity( identity );
					if (item) {
						this._mergeItems( item, servItems[i] );
						items.push(item);
					} else {
						// If no directory path included it must be a top-level item.
						if (identity.indexOf("/") === -1) {
							item = this._newItem( servItems[i], null, true );
							items.push(item);
						} else {
							throw new Error(this.moduleName+"::_uploadDataToStore: Item ["+identity+"] not found in store.");
						}
					}
				}
			}
			return items;
		},

		_uploadRenamedItem: function (/*Object*/ dataObject, /*Object*/keywordArgs ) {
			// summary:
			//		Upload the renamed item to the store. The original store item is deleted and
			//		a new one with its new name and/or path is created. As a result the original
			//		item is no longer a valid store item and any custom attributes are lost.
			// dataObject:
			//		The JavaScript data object containing the raw data to convert into item format.
			// keywordArgs:
			//		Keyword arguments object of the original request
			// returns:
			//		An array of store items.
			// tag:
			//		private
			var oldItem = keywordArgs.item,
					items 	= [];
			
			var newItem = dataObject.items[0];
			if (newItem) {
				var newParent;
				var parentId,	last;
				
				last 			= newItem.path.lastIndexOf("/");
				parentId  = newItem.path.substr(0, last);
				newParent = this._getItemByIdentity( parentId );

				this._deleteItem( oldItem, true );
				// If there is a parent available, reload it so its children are filtered
				// and sorted correctly.
				if (newParent) {
					this._newItem( newItem, newParent, true );
					this.loadItem( { item: newParent, 
														queryOptions: this._queryOptions, 
														sort: this._sort, 
														forceLoad: true
													} );
				} else {
					// If there is a parentId but no parent it means the parent directory has
					// not been loaded yet. On the other hand, if there is not parentId it is
					// a top-level store entry.
					if (!parentId) {
						this._newItem( newItem, null, true );
					}
				}
				items.push(newItem);
			}
			return items;
		},

		//=========================================================================
		// Public Methods
		
		close: function (/*dojo.data.api.Request || keywordArgs || null */ request) {
			// summary:
			//		See dojo.data.api.Read.close()
			// request:
			// tag:
			//		public
			if (this.clearOnClose && this._loadFinished && !this._loadInProgress) {
				//	Reset all internals back to default state. This will force a reload
				//	on the next fetch. This also checks that the data or url param was
				//	set so that the store knows it can get data.  Without one of those
				//	being set, the next fetch will trigger an error.
				if ((this.url == "" || this.url == null)) {
					console.debug(this.moduleName+"::close: WARNING!  Data reload " +
						" information has not been provided." +
						"  Please set 'url' to the appropriate value before" +
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
			//		A valid File Store item
			// attribute:
			//		Attribute name string.
			// value:
			//		Value to be matched.
			// tag:
			//		Public
			var regexp = undefined;
			if (typeof value === "string") {
				regexp = filterUtil.patternToRegExp(value, false);
			}
			return this._containsValue(item, attribute, value, regexp); //boolean.
		},

		deleteItem: function(/*item*/ item, /*Callback*/ onBegin, /*Callback*/ onComplete, 
													/*Callback*/ onError, /*Context*/ scope) {
			// summary:
			//		Delete an item from the back-end server and store. A XHR delete is issued
			//		and the server response includes the file(s) that have succesfully been
			//		deleted. Only those items will be deleted from the store.
			// item:
			//		A valid File Store item
			// onBegin:
			//		If an onBegin callback function is provided, the callback function
			//		will be called just once, before the XHR DELETE request is issued.
			//		The onBegin callback MUST return true in order to proceed with the
			//		deletion, any other return value will abort the operation.
			// onComplete:
			//		If an onComplete callback function is provided, the callback function
			//		will be called once on successful completion of the delete operation
			//		with the list of deleted file store items: onComplete(items)
			// onError:
			//		The onError parameter is the callback to invoke when the item rename
			//		encountered an error. It takes two parameter, the error object and
			//		the HTTP status code if available: onError(err, status)
			// scope:
			//		If a scope object is provided, all of the callback functions (onBegin,
			//		onError, etc) will be invoked in the context of the scope object. In
			//		the body of the callback function, the value of the "this" keyword
			//		will be the scope object otherwise window.global is used.
			// tag:
			//		Public
			var scope = scope || window.global;
			var self  = this;

			this._assertIsItem(item);

			if (onBegin) {
				if (onBegin.call(scope, item) !== true) {
					return;
				}
			}
			if (this._loadInProgress) {
				this._queuedFetches.push({args: item, func: this.deleteItem, scope: self});
			} else {
				this._loadInProgress = true;

				var request    = { path: item.path };
				var getArgs    = this._requestToArgs( "DELETE", request );
				var getHandler = xhr.del(getArgs);
				var items;

				getHandler.addCallback(function (data) {
					try{
						self._loadInProgress = false;
						items = self._deleteItems( data );
						self._handleQueuedFetches();
						if (onComplete) {
							onComplete.call(scope, items);
						}
					}catch(error) {
						self._loadInProgress = false;
						if (onError) {
							onError.call(scope, error);
						}	else {
							throw error;
						}
					}
				});
				getHandler.addErrback(function (error) {
					self._loadInProgress = false;
					switch( getArgs.status ) {
						case 404:		// Not Found
						case 410:		// Gone
							self._deleteItem( item, true );
							break;
						case 400:		// Bad Request
						case 405:		// Method Not Allowed
						case 500:		// Server error.
						default:
							if (onError) {
								onError.call(scope, error, getArgs.status);
							}
							break;
					}
				});
			}
		},

		fetch: function (/*Object*/ keywordArgs) {
			// summary:
			//		Given a query and set of defined options, such as a start and count of items to return,
			//		this method executes the query and makes the results available as data items.
			// keywordArgs:
			//		See dojo/data/api/Read.js
			// tag:
			//		Public
			var scope = keywordArgs.scope || window.global;
			var qopts = keywordArgs.queryOptions || null;
			var deep  = qopts ? qopts.deep : false;
			var self  = this;

			if (this._loadFinished) {
				this._fetchFromStore(keywordArgs, (deep ? this._arrayOfAllItems : this._arrayOfTopLevelItems));
			} else {
				// If fetches come in before the loading has finished, but while
				// a load is in progress, we have to defer the fetching to be
				// invoked in the callback.
				if (this._loadInProgress) {
					this._queuedFetches.push({args: keywordArgs, func: this.fetch, scope: self});
				} else {
					this._loadInProgress = true;
					var getArgs    = this._requestToArgs( "GET", keywordArgs );
					var getHandler = xhr.get(getArgs);
					getHandler.addCallback(function (data) {
						try {
							var items = self._uploadDataToStore(data, keywordArgs);
							self._loadFinished   = true;
							self._loadInProgress = false;
							self._fetchComplete(keywordArgs, items);
							self._handleQueuedFetches();
						} catch(error) {
							self._loadInProgress = false;
							if (keywordArgs.onError) {
								keywordArgs.onError.call(scope, error);
							} else {
								throw error;
							}
						}
					});
					getHandler.addErrback(function (error) {
						self._loadInProgress = false;
						if (keywordArgs.onError) {
							keywordArgs.onError.call(scope, error, getArgs.status);
						} else {
							throw error;
						}
					});
				}
			}
			return keywordArgs;
		},

		fetchItemByIdentity: function (/*Object*/ keywordArgs) {
			// summary:
			//		See dojo.data.api.Identity.fetchItemByIdentity()
			// keywordArgs:
			//		See dojo/data/api/Identity.js
			// tag:
			//		Public
			var scope = keywordArgs.scope || window.global;
			var path  = keywordArgs.identity || keywordArgs[this._identifier];
			var self  = this;
			var item;

			// Check store in case it already exists.
			item = this._getItemByIdentity(path);
			if (this.cache && this._loadFinished) {
				if (item) {
					if (keywordArgs.onItem) {
						keywordArgs.onItem.call(scope, item);
					}
					return;
				}
			}

			if (this._loadInProgress) {
				this._queuedFetches.push({args: keywordArgs, func: this.fetchItemByIdentity, scope: self});
			} else {
				this._loadInProgress = true;
				var request    = { path: path };
				var getArgs    = this._requestToArgs( "GET", request );
				var getHandler = xhr.get(getArgs);
				var items      = null;
				getHandler.addCallback(function (data) {
					try{
						items = self._uploadDataToStore(data, keywordArgs);
						item  = items ? items[0] : null;
						self._loadFinished   = true;
						self._loadInProgress = false;
						if (keywordArgs.onItem) {
							keywordArgs.onItem.call(scope, item);
						}
						self._handleQueuedFetches();
					} catch(error) {
						self._loadInProgress = false;
						if (keywordArgs.onError) {
							keywordArgs.onError.call(scope, error);
						} else {
							throw error;
						}
					}
				});
				getHandler.addErrback(function (error) {
					self._loadInProgress = false;
					if (getArgs.status == 404) {
						if (keywordArgs.onItem) {
							keywordArgs.onItem.call(scope, null);
						}
						// If item was found in the store but not on the server, delete it.
						if (item) {
							self._deleteItem( item, true );
						}
					} else {
						if (keywordArgs.onError) {
							keywordArgs.onError.call(scope, error);
						}
					}
				});
			}
		},

		getAttributes: function (/*item*/ item) {
			// summary:
			//		See dojo.data.api.Read.getAttributes()
			// item:
			//		A valid File Store item
			// tag:
			//		public
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

		getDirectory: function(/*item*/ item ) {
			// summary:
			//		Return the directory path of a store item. The directory path of an
			//		item is the path property of its parent.
			// item:
			//		A valid File Store item
			// tag:
			//		public			
			this._assertIsItem(item);
			var	parent;

			parent = this.getParents(item)[0];
			if (parent) {
				return parent[this._identifier];
			} else {
				if (this.isRootItem(item)) {
					return "";
				}
			}
		},

		getFeatures: function () {
			// summary:
			//		See dojo.data.api.Read.getFeatures()
			// tag:
			//		public
			return this._features; //Object
		},

		getIdentity: function (/*item*/ item) {
			// summary:
			//		See dojo.data.api.Identity.getIdentity()
			// item:
			//		A valid File Store item
			// tag:
			//		public
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
			// item:
			//		A valid File Store item
			// tag:
			//		public
			return [this._identifier]; // Array
		},

		getLabel: function (/*item*/ item) {
			// summary:
			//		See dojo.data.api.Read.getLabel()
			// item:
			//		A valid File Store item
			// tag:
			//		public
			if (this._labelAttr && this.isItem(item)) {
				return this.getValue(item,this._labelAttr); //String
			}
			return undefined; //undefined
		},

		getLabelAttributes: function (/*item*/ item) {
			// summary:
			//		See dojo.data.api.Read.getLabelAttributes()
			// item:
			//		A valid File Store item
			// tag:
			//		public
			return (this._labelAttr ? [this._labelAttr] : null);
		},

		getParents: function (/*item*/ item) {
			// summary:
			//		Get the parent(s) of a item.	
			// description:
			//		Get the parent(s) of a FileStore item.	The '_reverseRefMap' property
			//		is used to fetch the parent(s). (there should only be one).
			// item:
			//		The File Store item whose parent(s) will be returned.

			if (item) {
				return item[this._reverseRefMap] || [];
			}
		},

		getValue: function (	/*item*/ item, /*String*/ attribute,	/* value? */ defaultValue) {
			// summary:
			//		See dojo.data.api.Read.getValue()
			// item:
			//		A valid File Store item
			// attribute:
			//		Attribute/property name string
			// defaultValue:
			//		Default value to be returned if attribute value is undefined.
			// tag:
			//		public
			var values = this.getValues(item, attribute);
			return (values.length > 0) ? values[0] : defaultValue; // mixed
		},

		getValues: function (/*item*/ item,	/*String*/ attribute) {
			// summary:
			//		See dojo.data.api.Read.getValues()
			// item:
			//		A valid File Store item
			// tag:
			//		public
			var result = [];

			this._assertIsItem(item);
			this._assertIsAttribute(attribute, "getValues");

			if (item[attribute] !== undefined) {
				result = lang.isArray(item[attribute]) ? item[attribute] : [item[attribute]];
			}
			return result.slice(0);
		},

		hasAttribute: function (	/*item*/ item, /*String*/ attribute) {
			// summary:
			//		See dojo.data.api.Read.hasAttribute()
			// item:
			//		A valid File Store item
			// attribute:
			//		Attribute/property name to be evaluated
			// tag:
			//		public
			this._assertIsItem(item);
			this._assertIsAttribute(attribute, "hasAttribute");
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
			// item:
			//		A valid File Store item
			// tag:
			//		public
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
			//		Returns true if the item is a top-level store entry (store root entry)
			//		otherwise false is returned.
			// item:
			//		A valid File Store item.
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
			//		Given an item, this method loads the item so that a subsequent call to
			//		isItemLoaded(item) will return true. If a call to isItemLoaded() returns
			//		true before loadItem() is even called, then loadItem() need not do any
			//		work at all and will not even invoke the callback handlers.	So, before
			//		invoking this method, check that the item has not already been loaded.
			// keywordArgs:
			//		See dojo/data/api/Read.js
			// tag:
			//		public
			
			var queryOptions = keywordArgs.queryOptions || null;
			var forceLoad		 = keywordArgs.forceLoad || false;
			var scope 			 = keywordArgs.scope || window.global;
			var sort	 			 = keywordArgs.sort || null;
			var item = keywordArgs.item;
			var self = this;
			
			if (forceLoad !== true) {
				if (this.isItemLoaded(item)) {
					return;
				}
			}
			if (this._loadInProgress) {
				this._queuedFetches.push({args: keywordArgs, func: this.loadItem, scope: self});
			} else {
				this._loadInProgress = true;
				var request    = { path: item.path, queryOptions: queryOptions, sort: sort };
				var getArgs    = this._requestToArgs( "GET", request );
				var getHandler = xhr.get(getArgs);
				getHandler.addCallback(function (data) {
					try{
						var items = self._uploadDataToStore(data, keywordArgs);
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
						self._deleteItem( item, true );
					}
					if (keywordArgs.onError) {
						keywordArgs.onError.call(scope, error, getArgs.status);
					}
				});
			}
		},

		loadStore: function (/*Object?*/ query, /*object?*/ fetchArgs ) {
			// summary:
			//		Try a forced load of the entire store but only if it has not
			//		already been loaded.
			//
			// query:
			// fetchArgs:
			// tag:
			//		public
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

		renameItem: function(/*item*/ item, /*String*/ newPath, /*Callback?*/ onItem, /*Callback?*/ onError, 
													/*Context?*/ scope) {
			// summary:
			//		Rename a store item. 
			// item:
			//		A valid File Store item
			// newPath:
			//		The new pathname of the item. (relative to the stores basePath)
			// onItem:
			//		The callback function to invoke when the item has been renamed. It
			//		takes only one parameter, the renamed item: onItem(item)
			// onError:
			//		The onError parameter is the callback to invoke when the item rename
			//		encountered an error. It takes two parameter, the error object and
			//		the HTTP status code if available: onError(err, status)
			// scope:
			//		If a scope object is provided, all of the callback functions (onItem,
			//		onError, etc) will be invoked in the context of the scope object. In
			//		the body of the callback function, the value of the "this" keyword
			//		will be the scope object otherwise window.global is used.
			// tag:
			//		Public
			var scope = scope || window.global;

			this._assertIsItem(item);
			this._assertIsAttribute(newPath, "renameItem");
			
			if (item[this._identifier] !== newPath) {
				var keywordArgs = { item: item, attribute: this._identifier, oldValue: item[this._identifier], 
														newValue: newPath, onItem: onItem, onError: onError, scope: scope };
				this._renameItem( keywordArgs );
			} else {
				if (lang.isFunction(onItem) ) {
					onItem.call(scope, item);
				}	
			}
		},

		set: function (/*String*/ attribute, /*anytype*/ value) {
			// summary:
			//		Provide the setter capabilities for the store similar to dijit widgets.
			// attribute:
			//		Name of store property to set
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
		
		setValue: function (/*item*/ item, /*attribute*/ attribute, /*anthing*/ newValue ) {
			// summary:
			//		Set a new attribute value. Note: this method only allows modification
			//		of custom attributes. Please refer to renameItem() to change the store
			//		item identity.
			// item:
			//		A valid File Store item
			// attribute:
			//		Name of item attribute/property to set
			// newValue:
			//		New value to be assigned.
			// tag:
			//		public
			var oldValue;
			var	i;
			
			this._assertIsItem(item);
			this._assertIsAttribute(attribute, "setValue");

			if (typeof newValue === "undefined") {
				throw new Error(this.moduleName+"::setValue: newValue is undefined");
			}
			if (this._isReadOnlyAttr(attribute) || this._isPrivateAttr(attribute)) {
				throw new Error(this.moduleName+"::setValue: attribute ["+attribute+"] is private or read-only");
			}
			oldValue = item[attribute];
			item[attribute] = newValue;

			this.onSet(item, attribute, oldValue, newValue);
			return true;
		},

		setValues: function(/*item*/ item, /*attribute*/ attribute, /*anything*/ newValues) {
			//		Set a new attribute value. 
			// item:
			//		A valid File Store item
			// attribute:
			//		Name of item attribute/property to set
			// newValues:
			//		New values to be assigned.
			// tag:
			//		public
			var oldValues;
			var	i;
			
			this._assertIsItem(item);
			this._assertIsAttribute(attribute, "setValues");

			if (typeof newValues === "undefined") {
				throw new Error(this.moduleName+"::setValue: newValue is undefined");
			}
			if (this._isReadOnlyAttr(attribute) || this._isPrivateAttr(attribute)) {
				throw new Error(this.moduleName+"::setValues: attribute ["+attribute+"] is private or read-only");
			}
			return this._setValues( item, attribute, newValues, true );
		},

		unsetAttribute: function (/*item*/ item, /*attribute*/ attribute) {
			// summary: 
			//		See dojo.data.api.Write.unsetAttribute()
			// item:
			//		A valid File Store item
			// attribute:
			//		Name of item attribute/property to set
			// tag:
			//		public
			return this.setValues(item, attribute, []);
		},

		// =======================================================================
		//	Event hooks. (Callbacks)

		onDelete: function (/*item*/ deletedItem) {
			// summary: 
			//		See dojo.data.api.Notification.onDelete()
			// tag:
			//		Callback
		},

		onLoaded: function () {
			// summary:
			//		Invoked when loading the store completes.
			// tag:
			//		callback.
		},
		
		onNew: function(/* item */ newItem, /*object?*/ parentInfo){
			// summary: 
			//		See dojo.data.api.Notification.onNew()
			// tag:
			//		Callback
		},

		onSet: function (/*item*/ item,	/*attribute*/ attribute, /*object|array*/ oldValue, /*object|array*/ newValue) {
			// summary: 
			//		See dojo.data.api.Notification.onSet()
			// item:
			//		File Store item.
			// attribute:
			//		Attribute name whose value changed.
			// oldValue:
			// newValue:
			// tag:
			//		callback.
		},

		// =======================================================================
		// Unsupported dojo/data/api/Write API functions.

		isDirty: function (/*item?*/ item) {
			return false;
		},
		
		newItem: function() {
			this._assertNoSupport( "newItem" );
		},
		
		revert: function() {
			this._assertNoSupport( "revert" );
		},
		
		save: function() {
			// Nothing to save....
		},

		// =======================================================================
		// Store Model API extensions. (cbtree/models/StoreModel-API)

		addReference: function() {
			this._assertNoSupport( "addReference" );
		},
		
		attachToRoot: function() {
			this._assertNoSupport( "attachToRoot" );
		},
		
		detachFromRoot: function() {
			this._assertNoSupport( "detachFromRoot" );
		},
		
		itemExist: function (/*Object*/ keywordArgs) {
			// summary:
			//		Tests if, and return, a store item if it exists.
			// keywordArgs:
			//		Object defining the store item properties.
			// returns:
			//		The item if is exist
			// tag:
			//		public
			var	itemIdentity,
					item;
			
			if (typeof keywordArgs != "object"){
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

		removeReference: function() {
			this._assertNoSupport( "removeReference" );
		}
				
	});
	return FileStore;
});
