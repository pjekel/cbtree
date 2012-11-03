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
define(["dojo/_base/declare", 	// declare
				"dojo/_base/lang",			// lang.hitch
				"dojo/aspect",					// aspect.before()
				"dojo/Deferred",
				"dojo/has",							// has.add
				"dojo/promise/all",
				"dojo/promise/Promise",	// instanceof
				"dojo/Stateful",				// get() and set()
				"dojo/when",						// when()
				"./_Parents"
			 ], function (declare, lang, aspect, Deferred, has, all, Promise, Stateful, when, Parents){
	"use strict";
		// module:
		//		cbtree/models/ObjectStoreModel
		// summary:
		//		Implements cbtree.models.model connecting to a dojo/store. This model
		//		is primarily intended for the use with an observable dojo/store, this
		//		because the native dojo/store does not generate any meaningful events.

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;

	return declare([Stateful], {

		//==============================
		// Keyword arguments (kwArgs) to constructor

		// checkedAll: Boolean
		//		If true, every store item will receive a 'checked' state property regard-
		//		less if the 'checked' attribute is specified in the dojo.store
		checkedAll: true,

		// checkedState: Boolean
		//		The default state applied to every store item unless otherwise specified
		//		in the dojo.store (see also: checkedAttr)
		checkedState: false,

		// checkedRoot: Boolean
		//		If true, the root node will receive a checked state. This attribute is
		//		independent of  the showRoot attribute of the tree itself. If the tree
		//		attribute showRoot is set to false the checked state for the root will
		//		not show either.
		checkedRoot: false,

		// checkedStrict: Boolean
		//		If true, a strict parent-child relation is maintained.   For example,
		//		if all children are checked the parent will automatically recieve the
		//		same checked state or if any of the children are unchecked the parent
		//		will, depending if multi state is enabled, recieve either a mixed or
		//		unchecked state.
		checkedStrict: true,

		// checkedAttr: String
		//		The attribute name (property of the store item) that holds the 'checked'
		//		state. On load it specifies the store items initial checked state.	 For
		//		example: { name:'Egypt', type:'country', checked: true } If a store item
		//		has no 'checked' attribute specified it will depend on the model property
		//		'checkedAll' if one will be created automatically and if so, its initial
		//		state will be set as specified by 'checkedState'.
		checkedAttr: "checked",

		// enabledAttr: String
		//		The attribute name (property of the store item) that holds the 'enabled'
		//		state of the checkbox or alternative widget.
		//		Note: Eventhough it is referred to as the 'enabled' state the tree will
		//		only use this property to enable/disable the 'ReadOnly' property of a
		//		checkbox. This because disabling a widget may exclude it from HTTP POST
		//		operations.
		enabledAttr:"",

		// iconAttr: String
		//		If specified, get the icon from an item using this attribute name.
		iconAttr: "",

		// labelAttr: String
		//		If specified, get label for tree node from this attribute.
		labelAttr: "name",

		// multiState: Boolean
		//		Determines if the checked state needs to be maintained as multi state or
		//		or as a dual state. ({"mixed",true,false} vs {true,false}).
		multiState: true,

		// normalize: Boolean
		//		When true, the checked state of any non branch checkbox is normalized, that
		//		is, true or false. When normalization is enabled checkboxes associated with
		//		tree leafs can never have a mixed state.
		normalize: true,

		// parentAttr: String
		//		The property name of a store item identifying its parent ID. The default
		//		dojo/store requires the property name to be 'parent'.
		parentAttr: "parent",

		// query: String
		//		Specifies the set of children of the root item.
		// example:
		//		{type:'continent'}
		query: null,

		// store: dojo.store
		//		Underlying store
		store: null,

		// End Parameters to constructor
		//==============================

		moduleName: "cbTree/models/ObjectStoreModel",

		 // root: [readonly] Object
		//		Pointer to the root item (read only, not a parameter)
		root: null,

		// _validateStore: Boolean
		_validateStore: true,

		// _validating: [private] Number
		//		If not equal to zero it indicates store validation is on going.
		_validating: 0,

		constructor: function(/* Object */ kwArgs){
			// summary:
			//		Passed the arguments listed above (store, etc)
			// tags:
			//		private

			this.childrenCache = {};	// map from id to array of children
			this.objects = {};

			declare.safeMixin(this, kwArgs);

			var store = this.store;

			if (store) {
				has.add("tree-model-getChecked", 1);
				if (store.put && typeof store.put === "function") {
					has.add("tree-model-setChecked", 1);
					this._writeEnabled = true;
				} else {
					console.warn(this.moduleName+"::constructor(): store is not write enabled.");
					this._writeEnabled = false;
				}

				//	Extend the store to provide support for getChildren() and Drag-n-Drop.
				//	For DnD to work correctly there are two requirements that must be met:
				//
				//		1 - The ID of a parent object, if specified, must be set as the
				//				parent property of the store object.
				// 		2 - To determine if an item dropped on the tree is under control
				//				of this model/store or comes from an external source, a store
				//				reference is added to the object. This new store property is
				//				used by the isItem() method.
				//
				if (!store.getChildren) {
					var funcBody = "return this.query({"+this.parentAttr+": this.getIdentity(object)});"
					store.getChildren = new Function("object", funcBody);
				}
				// If the store is not observable we will have to fire some of the events
				// ourselves.
				if (!store.notify || !(typeof store.notify === "function")) {
					console.warn("Specified store is not observable.");
					this._notObservable = true;
				}

				// Provide support for single and multi parented objects. (Note, the store
				// method getIdentity() is used to establish the parent id instead of simply
				// relying on the presence of an 'id' property, this because more complex
				// stores may actually use a key path. (see indexedStore).
				//
				// Note:	The prelogue method only takes effect after the store has been
				//				created, any existing data in the store is not auto converted.

				var prelogue = function _prelogue (/*Object*/ obj, /*Object*/ options) {
					if(options && options.parent){
						if (options.parent instanceof Array) {
							var id, parents = [];
							options.parent.forEach( function(parent) {
								if (id = this.getIdentity(parent)) {
									parents.push(id);
								}
							}, this);
							obj.parent = parents;
						} else {
							obj.parent = this.getIdentity(options.parent);
						}
					} else {
						obj.parent = obj.parent || undefined;
					}
					defineProperty( obj, "__store", {value: this, enumerable: false, writable: false});
				};

				// Don't make the assumption that store.add() calls store.put() like the
				// dojo/store/Memory store does.
				aspect.before( store, "add", prelogue );
				aspect.before( store, "put", prelogue );
			} else {
				throw new Error(this.moduleName+"::constructor(): Store parameter is required");
			}
		},

		destroy: function(){
			// summary:
			//		Distroy this model.
			var handle, id;
			for(id in this.childrenCache){
				if(handle = this.childrenCache[id].handle) {
					handle.remove();
				}
			}
			// Release memory.
			this.childrenCache = {};
			this.objects = {};
			this.store   = undefined;
		},

		// =======================================================================
		// Model getters and setters (See dojo/Stateful)

		_checkedStrictSetter: function (value){
			// summary:
			//		Hook for the set("checkedStrict",value) calls. Note: A full store
			//		re-evaluation is only kicked off when the current value is false
			//		and the new value is true.
			// value:
			//		New value applied to 'checkedStrict'. Any value is converted to a boolean.
			// tag:
			//		private

			value = !!value;
			if (this.checkedStrict !== value) {
				this.checkedStrict = value;
				if (this.checkedStrict) {
					this.getRoot( lang.hitch(this, function (rootItem) {
							this.getChildren(rootItem, lang.hitch(this, function(children) {
									this._validateChildren(rootItem, children);
								}))
						}))
				}
			}
			return this.checkedStrict;
		},

		_enabledAttrSetter: function (/*String*/ value) {
			// summary:
			//		Set the enabledAttr property. This method is the hook for set("enabledAttr", ...)
			//		The enabledAttr value can only be set once during the model instantiation.
			// value:
			//		New enabledAttr value.
			// tags:
			//		private

			if (typeof value === "string") {
				if (this.enabledAttr !== value) {
					throw new Error(this.moduleName+"::set(): enabledAttr property is read-only.");
				}
			} else {
				throw new Error(this.moduleName+"::set(): enabledAttr value must be a string");
			}
			return this.enabledAttr;
		},

		// =======================================================================
		// Methods for traversing hierarchy

		getChildren: function(/*Object*/ parentItem, /*Function*/ onComplete, /*Function*/ onError) {
			// summary:
			//		Calls onComplete() with array of child items of given parent item,
			//		all loaded.
			// parentItem:
			//		Object.
			// onComplete:
			//		Callback function, called on completion with an array of child items
			//		as the argumen: onComplete(children)
			// onError:
			//		Callback function, called in case an error occurred.
			// tags:
			//		public

			var id = this.store.getIdentity(parentItem);
			if(this.childrenCache[id]){
				when(this.childrenCache[id], onComplete, onError);
				return;
			}
			var res  = this.childrenCache[id] = this.store.getChildren(parentItem);
			var self = this;

			// Setup listener in case children list changes, or the item(s) in the
			// children list are updated in some way.
			if(res.observe){
				var handle = res.observe( function(obj, removedFrom, insertedInto) {
					if (insertedInto == -1) {
						when( res, lang.hitch(self, "onDeleteItem", obj, parentItem ));
					} else if (removedFrom == -1) {
						when( res, lang.hitch(self, "onNewItem", obj, parentItem ));
					} else if (removedFrom == insertedInto) {
						var orgObj = self.objects[self.store.getIdentity(obj)];
						// Mimic the dojo/data/store onSet event type
						when( res, lang.hitch(self, "onSetItem", orgObj, obj, parentItem));
					} else {
						// insertedInto != removedFrom, this conddition indicates the item
						// moved within the tree. Typically, this should have been capture
						// by pasteItem() unless the user is doing some funcky stuff....
						when(res, function(children) {
							children = Array.prototype.slice.call(children);
							self.onChildrenChange(parentItem, children);
						});
					}
				}, true);	// true means to notify on item changes
				res.handle = handle;
			}
			// Call User callback AFTER registering any listeners.
			when(res, onComplete, onError);
		},

		getParents: function (/*Object*/ storeItem) {
			// summary:
			//		Get the parent(s) of a store item.
			// storeItem:
			//		The store object whose parent(s) will be returned.
			// returns:
			//		Array of objects or an empty array.
			// returns:
			//		A dojo/promise/Promise
			// tags:
			//		private
			var deferred = new Deferred();
			var parents  = [];

			if (storeItem && storeItem[this.parentAttr]) {
				var parentIds = new Parents( storeItem[this.parentAttr] );
				var promises  = [];
				var parent;

				parentIds.forEach( function (id) {
					parent = this.store.get(id);
					when( parent, function(parent) {
						if (parent) {
							parents.push(parent);
						}
					});
					promises.push(parent);
				}, this);

				all(promises).always( function() {
					deferred.resolve(parents);
				});
			}
			return deferred.promise;
		},

		getRoot: function(/*Function*/ onItem, /*Function*/ onError){
			// summary:
			//		Calls onItem with the root item for the tree.
			//		Calls onError on error.
			// onItem:
			//		Function called with the root item for the tree.
			// onError:
			//		Function called in case an error occurred.
			if(this.root){
				onItem(this.root);
			}else{
				var res  = this.store.query(this.query);
				var self = this;
				when(res, function(items) {
					if(items.length != 1){
						throw new Error(this.moduleName + ": query " + self.query + " returned " + items.length +
															" items, but must return exactly one item");
					}
					self.root = items[0];
					// Setup listener to detect if root item changes
					if(res.observe) {
						res.observe( function(obj, removedFrom, insertedInto) {
							if (removedFrom == insertedInto) {
								var id = self.store.getIdentity(obj);
								self.onSetItem( self.objects[id], obj );
							}
							self.onChange(obj);
						}, true);	// true to listen for updates to obj
					}
					// Call onItem AFTER registering any listener.
					onItem(self.root);

				},
				onError);
			}
		},

		mayHaveChildren: function(/*Object*/ item){
			// summary:
			//		Tells if an item has or may have children. Implementing logic here
			//		avoids showing +/- expando icon for nodes that we know don't have
			//		children.
			// item:
			//		Object.
			// tags:
			//		public

			var itemId = this.store.getIdentity(item);
			var result = this.childrenCache[itemId];
/*
			if (result) {
				if (result instanceof Promise) {
					return !result.isFulfilled();
				}
				return !!Array.prototype.slice.call(result).length;
			}
*/
			return true;		// We just don't know at this point.
		},

		// =======================================================================
		// Private Checked state handling

		_getCompositeState: function (/*Object[]*/ children) {
			// summary:
			//		Compile the composite state based on the checked state of a group
			//		of children.	If any child has a mixed state, the composite state
			//		will always be mixed, on the other hand, if none of the children
			//		has a checked state the composite state will be undefined.
			// children:
			//		Array of dojo/store items
			// tags:
			//		private

			var hasChecked	 = false,
					hasUnchecked = false,
					isMixed			= false,
					newState,
					state;

			children.some( function (child) {
				state = this.getChecked(child);
				isMixed |= (state == "mixed");
				switch(state) {	// ignore 'undefined' state
					case true:
						hasChecked = true;
						break;
					case false:
						hasUnchecked = true;
						break;
				}
				return isMixed;
			}, this);
			// At least one checked/unchecked required to change parent state.
			if (isMixed || hasChecked || hasUnchecked) {
				isMixed |= !(hasChecked ^ hasUnchecked);
				newState = (isMixed ? "mixed" : hasChecked ? true: false);
			}
			return newState;
		},

		_normalizeState: function (/*Object*/ storeItem, /*Boolean|String*/ state) {
			// summary:
			//		Normalize the checked state value so we don't store an invalid state
			//		for a store item.
			//	storeItem:
			//		The store item whose checked state is normalized.
			//	state:
			//		The checked state: 'mixed', true or false.
			// tags:
			//		private

			if (typeof state == "boolean") {
				return state;
			}
			if (this.multiState && state == "mixed") {
				if (this.normalize && !this.mayHaveChildren(storeItem)){
						return true;
				}
				return state;
			}
			return state ? true : false;
		},

		_setChecked: function (/*Object*/ storeItem, /*Boolean|String*/ newState) {
			// summary:
			//		Set/update the checked state on the dojo/store item. Returns true if
			//		the checked state changed otherwise false.
			// description:
			//		Set/update the checked state on the dojo.store.	Retreive the
			//		current checked state	and validate if an update is required, this
			//		will keep store updates to a minimum. If the current checked state
			//		is undefined (ie: no checked attribute specified in the store) the
			//		'checkedAll' attribute is tested to see if a checked state needs to
			//		be created.	In case of the root node the 'checkedRoot' attribute
			//		is checked.
			//
			//		NOTE: The _setValue() method will add the attribute for the
			//					item if none exists.
			//
			//	storeItem:
			//		The item in the dojo.store whose checked state is updated.
			//	newState:
			//		The new checked state: 'mixed', true or false.
			//	tag:
			//		private

			var forceUpdate = false,
					normState;

			normState		= this._normalizeState(storeItem, newState);
			forceUpdate = (normState != newState);

			var currState = storeItem[this.checkedAttr];
			if ((currState !== undefined || this.checkedAll) && (currState != normState || forceUpdate)) {
				// Keep a shallow copy of the store item for comparison later.
				this.objects[ this.store.getIdentity(storeItem)] = lang.mixin( {}, storeItem);
				this._setValue(storeItem, this.checkedAttr, normState);
				if (this._notObservable) {
					this.onChange(storeItem, this.checkedAttr, normState);
					this._updateCheckedParent(storeItem, false);
				}
				return true;
			}
			return false;
		},

		_updateCheckedChild: function (/*Object*/ storeItem, /*Boolean*/ newState) {
			//	summary:
			//		Set the parent (the storeItem) and all childrens states to true/false.
			//	description:
			//		If a parent checked state changed, all child and grandchild states are
			//		updated to reflect the change. For example, if the parent state is set
			//		to true, all child and grandchild states will receive that same 'true'
			//		state.
			//
			//	storeItem:
			//		The parent store item whose child/grandchild states require updating.
			//	newState:
			//		The new checked state.
			//	tag:
			//		private

			// Set the (maybe) parent first. The order in which any child checked states
			// are set is important to optimize _updateCheckedParent() performance.
			var self= this;

			this._setChecked(storeItem, newState);
			this.getChildren(storeItem, function (children) {
					children.forEach( function (child) {
							self._updateCheckedChild(child, newState);
					});
				},
				this.onError );
		},

		_updateCheckedParent: function (/*Object*/ storeItem, /*Boolean*/ forceUpdate) {
			//	summary:
			//		Update the parent checked state according to the state of all its
			//		children checked states.
			//	storeItem:
			//		The store item (child) whose parent state requires updating.
			//	forceUpdate:
			//		Force an update of the parent(s) regardless of the current checked
			//		state of the child.
			//	tag:
			//		private

			if (!this.checkedStrict || !storeItem) {
				return;
			}
			var parents		 = this.getParents(storeItem),
					childState = this.getChecked(storeItem),
					self = this,
					newState;

			when(parents, function (parents) {
				parents.forEach( function (parentItem) {
					// Only process a parent update if the current child state differs from
					// its parent otherwise the parent is already up-to-date.
					if ((childState !== self.getChecked(parentItem)) || forceUpdate) {
						self.getChildren(parentItem, function (children) {
								newState = self._getCompositeState(children);
								if(newState !== undefined) {
									self._setChecked(parentItem, newState);
								}
							},
							self.onError);
					}
				}, this); /* end forEach() */
			});
		},

		_validateChildren: function ( parent, children) {
			// summary:
			//		Validate/normalize the parent(s) checked state in the dojo/store.
			// description:
			//		All parent checked states are set to the appropriate state according to
			//		the actual state(s) of their children. This will potentionally overwrite
			//		whatever was specified for the parent in the dojo/store.
			//		This will garantee the tree is in a consistent state after startup.
			//	parent:
			//		The parent item.
			//	children:
			//		Either the tree root or a list of child children
			//	tag:
			//		private

			var children,	currState, newState;
			this._validating += 1;

			children = children instanceof Array ? children : [children];
			children.forEach(	function (child) {
				this.getChildren( child, lang.hitch(this, function(children) {
						this._validateChildren(child, children);
					}),
					this.onError);
			}, this	);
			newState	= this._getCompositeState(children);
			currState = this.getChecked(parent);

			if (currState !== undefined && newState !== undefined) {
				this._setChecked(parent, newState);
			}

			// If the validation count drops to zero we're done.
			this._validating -= 1;
			if (!this._validating) {
				this.store.validated = true;
				this.onDataValidated();
			}
		},

		// =======================================================================
		// Checked and Enabled state

		getChecked: function (/*Object*/ storeItem) {
			// summary:
			//		Get the current checked state from the data store for the specified item.
			// description:
			//		Get the current checked state from the dojo.store. The checked state
			//		in the store can be: 'mixed', true, false or undefined. Undefined in this
			//		context means no checked identifier (checkedAttr) was found in the store
			//		Depending on the checked attributes as specified above the following will
			//		take place:
			//
			//		a)	If the current checked state is undefined and the checked attribute
			//				'checkedAll' or 'checkedRoot' is true one will be created and the
			//				default state 'checkedState' will be applied.
			//		b)	If the current state is undefined and 'checkedAll' is false the state
			//				undefined remains unchanged and is returned. This will prevent a tree
			//				node from creating a checkbox or other widget.
			//
			// storeItem:
			//		The item in the dojo.store whose checked state is returned.
			// tag:
			//		private

			if (storeItem == this.root && !this.checkedRoot) {
				return;
			}
			var checked = storeItem[this.checkedAttr];
			if (checked === undefined)
			{
				if (this.checkedAll) {
					this._setChecked(storeItem, this.checkedState);
					return this.checkedState;
				}
			}
			return checked;	// the current checked state (true/false or undefined)
		},

		getEnabled: function (/*item*/ item) {
			// summary:
			//		Returns the current 'enabled' state of an item as a boolean.
			// item:
			//		Store or root item
			// tag:
			//		Public
			var enabled = true;

			if (this.enabledAttr) {
				enabled = item[this.enabledAttr];
			}
			return (enabled === undefined) || !!enabled;
		},

		getItemState: function (/*item*/ item) {
			// summary:
			//		Returns the state of a item, the state is an object with two properies:
			//		'checked' and 'enabled'.
			// item:
			//		The store or root item.
			// tag:
			//		Public
			return { checked: this.getChecked(item),
								enabled: this.getEnabled(item) };
		},

		setChecked: function (/*Object*/ storeItem, /*Boolean*/ newState) {
			// summary:
			//		Update the checked state for the store item and the associated parents
			//		and children, if any.
			// description:
			//		Update the checked state for a single store item and the associated
			//		parent(s) and children, if any. This method is called from the tree if
			//		the user checked/unchecked a checkbox. The parent and child tree nodes
			//		are updated to maintain consistency if 'checkedStrict' is set to true.
			//	storeItem:
			//		The item in the dojo.store whose checked state needs updating.
			//	newState:
			//		The new checked state: 'mixed', true or false
			// tags:
			//		private

			if (!this.checkedStrict) {
				this._setChecked(storeItem, newState);		// Just update the checked state
			} else {
				this._updateCheckedChild(storeItem, newState); // Update children and parent(s).
			}
		},

		setEnabled: function (/*item*/ item, /*Boolean*/ value) {
			// summary:
			//		Sets the new 'enabled' state of an item.
			// item:
			//		Store or root item
			// tag:
			//		Public
			if (this.enabledAttr) {
				return this._setValue(item, this.enabledAttr, !!value);
			}
		},

		validateData: function () {
			// summary:
			//		Validate/normalize the parent-child checked state relationship. If the
			//		attribute 'checkedStrict' is true this method is called as part of the
			//		post creation of the Tree instance.	First we try a forced synchronous
			//		load of the Json dataObject dramatically improving the startup time.
			//	tag:
			//		private
			var self = this;

			if (this.checkedStrict && this._validateStore) {
				if (!this.store.isValidated) {
					this.getRoot( function (rootItem) {
						self.getChildren(rootItem, function (children) {
							self._validateChildren(rootItem, children);
						}, self.onError);
					}, self.onError);
				}
				this.onDataValidated();		// Trigger event.
			} else {
				this.store.isValidated = true;
			}
		},

		// =======================================================================
		// Inspecting items

		fetchItemByIdentity: function(/* object */ keywordArgs){
			// summary:
			//		Fetch a store item by identity
			this.store.get(keywordArgs.identity).then(
				lang.hitch(keywordArgs.scope, keywordArgs.onItem),
				lang.hitch(keywordArgs.scope, keywordArgs.onError)
			);
		},

		getIcon: function(/*item*/ item){
			// summary:
			//		Get the icon for item from the store if the iconAttr property of the
			//		model is set.
			// item:
			//		A valid dojo.store item.

			if (this.iconAttr) {
				return item[this.iconAttr];
			}
		},

		getIdentity: function(/*item*/ item){
			return this.store.getIdentity(item);	// Object
		},

		getLabel: function(/*Object*/ item){
			// summary:
			//		Get the label for an item
			return item[this.labelAttr];	// String
		},

		isItem: function(/*any*/ something){
			// summary:
			//		Validate if an item (something) is an object and under control of
			//		this model and store.  This method is primarily called by the DnD
			//		module dndSource.
			// something:
			//		Any type of object.
			// tag:
			//		Public
			if (Object.prototype.toString.call(something) == "[object Object]") {
				if (something.__store == this.store) {
					return true;
				}
			}
			return false;
		},

		// =======================================================================
		// Write interface

		deleteItem: function (/*Object*/ storeItem){
			// summary:
			//		Delete a store item.
			// storeItem:
			//		The store item to be delete.
			// tag:
			//		public

			var method = this.store.remove || this.store.delete;
			var self   = this;

			if (method && typeof method === "function") {
				var itemId = this.store.getIdentity(storeItem);
				method.call(this.store, itemId);

				// If this store is not observable we need to trigger all the appropriate
				// events for the tree.
				if (this._notObservable) {
					when( this.getParents(storeItem), function(parents) {
						parents.forEach( function(parent) {
							self.getChildren(parent, function(children) {
								self.onDeleteItem(storeItem, parent, children);
								self._updateCheckedParent(children[0]);
							});
						});
					});
				}
				return true;
			}
		},

		newItem: function(/* dijit/tree/dndSource.__Item */ args, /*Item*/ parent, /*int?*/ insertIndex, /*Item*/ before){
			// summary:
			//		Creates a new item.   See `dojo/data/api/Write` for details on args.
			//		Used in drag & drop when item from external source dropped onto tree.

			var result = this.store.put(args, { parent: parent, before: before });
			var self   = this;

			if (this._notObservable && parent) {
				when(result, function(itemId) {
					when( self.store.get(itemId), function(item) {
						var children = self._addChildToCache(item, parent);
						self.onNewItem(item, parent, children);
					});
				});
			}
			return this.store.get(result);
		},

		pasteItem: function(/*Item*/ childItem, /*Item*/ oldParentItem, /*Item*/ newParentItem,
					/*Boolean*/ bCopy, /*int?*/ insertIndex, /*Item*/ before){
			// summary:
			//		Move or copy an item from one parent item to another.
			//		Used in drag & drop

			if(!bCopy){
				// In order for DnD moves to work correctly, childItem needs to be orphaned from oldParentItem
				// before being adopted by newParentItem.   That way, the TreeNode is moved rather than
				// an additional TreeNode being created, and the old TreeNode subsequently being deleted.
				// The latter loses information such as selection and opened/closed children TreeNodes.
				// Unfortunately simply calling this.store.put() will send notifications in a random order, based
				// on when the TreeNodes in question originally appeared, and not based on the drag-from
				// TreeNode vs. the drop-onto TreeNode.

				var oldParentChildren = [].concat(this.childrenCache[this.getIdentity(oldParentItem)]), // concat to make copy
					index = oldParentChildren.indexOf(childItem);
				oldParentChildren.splice(index, 1);
				this.onChildrenChange(oldParentItem, oldParentChildren);
			}

			return this.store.put(childItem, {
				overwrite: true,
				parent: newParentItem,
				before: before
			});
		},

		_setValue: function (/*Object*/ item, /*String*/ attr, /*any*/ value) {
			// summary:
			//item:
			// attr:
			// value:
			if (item[attr] !== value) {
				item[attr] = value;
				this.store.put( item, {overwrite: true});
			}
		},

		// =======================================================================
		// Label Attribute

		getLabelAttr: function () {
			// summary:
			//		Returns the labelAttr property.
			// tags:
			//		public
			return this.labelAttr;
		},

		setLabelAttr: function (/*String*/ newValue) {
			// summary:
			//		Set the labelAttr property.
			// newValue:
			//		New labelAttr newValue.
			// tags:
			//		public
			if (typeof newValue === "string" && newValue.length) {
				if (this.labelAttr !== newValue) {
					var oldValue	 = this.labelAttr;
					this.labelAttr = newValue;
					// Signal the event.
					this.onLabelChange(oldValue, newValue);
				}
				return this.labelAttr;
			}
		},

		// =======================================================================
		// Callbacks

		onChange: function(/*===== item, attribute, newValue =====*/){
			// summary:
			//		Callback whenever an item has changed, so that Tree
			//		can update the label, icon, etc.	 Note that changes
			//		to an item's children or parent(s) will trigger an
			//		onChildrenChange() so you can ignore those changes here.
			// tags:
			//		callback
		},

		onChildrenChange: function(/*Object*/ parent, /*Object[]*/ newChildrenList){
			// summary:
			//		Callback to do notifications about new, updated, or deleted child items.
			// parent:
			// newChildrenList:
			// tags:
			//		callback
			var first = newChildrenList[0];
			var self  = this;

			setTimeout( function () {
				self._updateCheckedParent(first, true);
			}, 0);
		},

		onDataValidated: function(){
			// summary:
			//		Callback when store validation completion. Only called if strict
			//		parent-child relationship is enabled.
			// tag:
			//		callback
		},

		onDelete: function(/*===== item =====*/){
			// summary:
			//		Callback when an item has been deleted.
			// description:
			//		Note that there will also be an onChildrenChange() callback for the parent
			//		of this item.
			// tags:
			//		callback
		},

		onLabelChange: function (/*===== oldValue, newValue =====*/){
			// summary:
			//		Callback when label attribute property changed.
			// tags:
			//		callback
		},

		// =======================================================================
		// Mimic the dojo/data/ItemFileReadStore events

		onNewItem: function (/*Object*/ item, /*Object*/ parentItem,/*QueryResult|Object[]*/ children) {
			// summary:
			//		Mimic the dojo/data/ItemFileReadStore onNew event.
			var self = this;
			// Check if it affects the root.
			when( this.getParents(item), function (parents) {
				parents.some( function (parent) {
					if (parent == self.root) {
						self.onRootChange(item, "new");
						return true;
					}
				});
			});
			children = Array.prototype.slice.call(children);
			this.onChildrenChange(parentItem, children);
		},

		onDeleteItem: function (/*Object*/ item, /*Object*/ parentItem,/*QueryResult|Object[]*/children) {
			// summary:
			//		Handler for delete notifications from the store.
			// storeItem:
			//		The store item that was deleted.

			var id   = this.store.getIdentity(item);
			var self = this;

			if (this.childrenCache[id]) {
				this.childrenCache[id].close && this.childrenCache[id].close();
				delete this.childrenCache[id];
			}
			delete this.objects[id];

			// Check if it affects the root.
			when( this.getParents(item), function (parents) {
				parents.some( function (parent) {
					if (parent == self.root) {
						self.onRootChange(item, "delete");
						return true;
					}
				});
			});
			// Because observable does not provide definitive information if the item
			// was actually deleted or just moved (re-parented) we need to check the
			// store and see if the item still exist.
			when(this.store.get(id), function(exists) {
				if (exists) {
					children = Array.prototype.slice.call(children);
					self.onChildrenChange(parentItem, children);
				} else {
					self._removeChildFromCache(item, parentItem);
					self.onDelete(item);
				}
			});
		},

		onError: function (/*Object*/ err) {
			// summary:
			//		Callback when an error occurred.
			// tags:
			//		callback
			console.error(this, err);
		},

		onSetItem: function (/*Object*/ orgItem,/*Object*/ updatedItem, /*Object*/ parentItem,
													/*QueryResult|Object[]*/ children) {
			// summary:
			//		Mimic the dojo/data/ItemFileReadStore onSet event type.
			var self = this;
			if (orgItem) {
				for (var key in orgItem) {
					if (orgItem[key] != updatedItem[key]) {
						if (key === this.checkedAttr) {
							setTimeout( function () {
								self._updateCheckedParent(updatedItem, false);
							}, 0);
						}
						this.onChange(updatedItem, key, updatedItem[key]);
					}
				}
			} else {
				children = Array.prototype.slice.call(children);
				this.onChildrenChange(parentItem, children);
			}
		},

		onRootChange: function (/*Object*/ storeItem, /*String*/ action) {
			// summary:
			//		Handler for any changes to tree root.
			// storeItem:
			//		The store item that was attached to, or detached from, the root.
			// action:
			//		String detailing the type of event: "new", "delete", "attach" or
			//		"detach"
			// tag:
			//		callback
		},

		toString: function () {
			return "[object ObjectStoreModel]";
		},

		//=========================================================================
		// Misc helper methods

		_addChildToCache: function(/*Object*/ childItem,/*Object*/ parentItem ) {
			// summary:
			//		Add child to the childrens cache.
			// childItem:
			// parentItem:
			// tag:
			//		Private
			if (childItem && parentItem) {
				var parentId = this.store.getIdentity(parentItem);
				var children = this.childrenCache[parentId] || [];

				children.push(childItem);
				this.childrenCache[parentId] = children;
				return children;
			}
		},

		_removeChildFromCache: function(/*Object*/ childItem,/*Object*/ parentItem ) {
			// summary:
			//		Remove a child from the childrens cache.
			// childItem:
			// parentItem:
			// tag:
			//		Private
			var parentId = this.store.getIdentity(parentItem);
			var children = this.childrenCache[parentId];
			var index    = children ? children.indexOf(childItem) : -1;

			if (index != -1) {
				children.splice(index,1);
			}
			return children;
		}

	});
});
