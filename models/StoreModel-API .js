/*=====
define(["./TreeStoreModel"], function (TreeStoreModel) {

	// Summary:
	//		Dijit CheckBox Tree model API prototypes.
	
	// Add cbTree model API to the available features list 
	has.add("cbTree-storeModel-API", true);

	lang.extend(TreeStoreModel, {

		// =======================================================================
		// Methods for traversing hierarchy

		getParents: function (item) {
			// summary:
			//		Get the parent(s) of an item.	
			// storeItem:
			//		The dojo.data.item whose parent(s) will be returned.
			// tags:
			//		public
		},
		
		// =======================================================================
		// Model getters and setters

		get: function (attribute){
			// summary:
			//		Provide the getter capabilities for the model.
			// attribute: String
			//		Name of property to get
			// tag:
			//		public
		},

		set: function (attribute, value){
			// summary:
			//		Provide the setter capabilities for the model.
			// attribute: String
			//		Name of property to set
			// value: AnyType
			//		New value of attribute
			// tag:
			//		public
		},
		
		// =======================================================================
		// Data store item getters and setters
		
		getItemAttr: function (item , attribute){
			// summary:
			//		Provide the getter capabilities for store items thru the model. 
			//		The getItemAttr() method strictly operates on store items not
			//		the model itself.
			// item: dojo.data.item
			//		The store item whose property to get.
			// attribute: String
			//		Name of property to get
			// tag:
			//		public
		},

		setItemAttr: function (item, attribute, value) {
			// summary:
			//		Provide the setter capabilities for store items thru the model.
			//		The setItemAttr() method strictly operates on store items not
			//		the model itself.
			// item: dojo.data.item
			//		The store item whose property is to be set.
			// attribute: String
			//		Property name to set.
			// value: AnyType
			//		Value to be applied.
			// tag:
			//		public
		},
		 
		// =======================================================================
		// Inspecting and validating items

		fetchItem: function (args, identAttr){
			// summary:
			// args: String|Object
			// identAttr: String?
			// tag:
			//		public
		},
		
		fetchItemsWithChecked: function (query, onComplete, scope) {
			// summary:
			//		Get the list of store items that match the query and have a checked 
			//		state, that is, a checkedAttr property.
			// description:
			//		Get the list of store items that match the query and have a checkbed
			//		state. This method provides a simplified interface to the data stores
			//		fetch() method.
			//	 query: String|Object
			//		A query object or string. If query is a string the label attribute of
			//		the store is used as the query attribute and the query string assigned
			//		as the associated value.
			//	onComplete: Callback
			//		 User specified callback method which is called on completion with an
			//		array of store items that matched the query argument. Method onComplete
			//		is called as: onComplete(items) in the context of scope if scope
			//		is specified otherwise in the active context (this).
			//	scope: Context
			//		If a scope object is provided, the function onComplete will be invoked
			//		in the context of the scope object. In the body of the callback function,
			//		the value of the "this" keyword will be the scope object. If no scope 
			//		object is provided, onComplete will be called in the context of tree.model.
			// tag:
			//		public
		},

		isRootItem: function (something){
			// summary:
			//		Returns true if 'something' is a top level item in the store otherwise false.
			// Something: AnyType
			// tag:
			//		public
		},

		// =======================================================================
		// Write interface

		addReference: function (childItem, parentItem){
			// summary:
			//		Add an existing item to the parentItem by reference.
			// childItem: dojo.data.item
			//		Child item to be added to the parents list of children.
			// parentItem: dojo.data.item
			//		Parent item.
			// tag:
			//		public
		},

		attachToRoot: function (item){
			// summary:
			//		Promote a store item to a top level item.
			// item: dojo.data.item
			//		A valid dojo.data.store item.
			// tag:
			//		public
		},
		
		check: function (query, onComplete, scope) {
			// summary:
			//		Check all store items that match the query.
			// description:
			//		See description _checkOrUncheck()
			//	example:
			//		model.check({ name: "John" }); 
			//	| model.check("John", myCallback, this);
			// tag:
			//		public
		},
		
		deleteItem: function (item){
			// summary:
			//		Delete a store item.
			// item: dojo.data.Item
			//		The store item to be delete.
			// tag:
			//		public
		},

		detachFromRoot: function (item) {
			// summary:
			//		Detach item from the root by removing it from the stores top level item
			//		list
			// item: dojo.data.Item
			//		A valid dojo.data.store item.
			// tag:
			//		public
		},

		newReferenceItem: function (args, parent, insertIndex){
			// summary:
			//		Create a new top level item and add it as a child to the parent.
			// description:
			//		In contrast to the newItem() method, this method ALWAYS creates the
			//		new item as a top level item regardsless if a parent is specified or
			//		not.
			// args: dojo.dnd.Item
			//		Object defining the new item properties.
			// parent: dojo.data.item
			//		Optional, a valid store item that will serve as the parent of the new
			//		item. (see also newItem())
			// insertIndex: int?
			//		If specified the location in the parents list of child items.
			// tag:
			//		public
		},

		removeReference: function (childItem, parentItem){
			// summary:
			//		Remove a child reference from its parent. Only the references are
			//		removed, the childItem is not delete.
			// childItem: dojo.data.item
			//		Child item to be removed from parents children list.
			// parentItem: dojo.data.item
			//		Parent item.
			// tag:
			//		public
		},
		
		uncheck: function (query, onComplete, scope) {
			// summary:
			//		Uncheck all store items that match the query.
			// description:
			//		See description _checkOrUncheck()
			//	example:
			//		uncheck({ name: "John" });
			//	| uncheck("John", myCallback, this);
			// tag:
			//		public
		}

	});

});
=====*/
