//
// Copyright (c) 2010-2012, Peter Jekel
// All rights reserved.
//
//	The Checkbox Tree (cbtree), also known as the 'Dijit Tree with Multi State Checkboxes'
//	is released under to following three licenses:
//
//	1 - BSD 2-Clause							 (http://thejekels.com/js/cbtree/LICENSE)
//	2 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	3 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
//	In case of doubt, the BSD 2-Clause license takes precedence.
//
define([
	"dojo/_base/array",
	"dojo/_base/declare",
	"dojo/_base/event",
	"dojo/_base/lang", 
	"dojo/_base/window",
	"dojo/dom",
	"dojo/dom-attr",
	"dojo/dom-class",
	"dojo/dom-construct",
	"dojo/dom-prop",
	"dojo/dom-style",
	"dojo/text!./templates/cbtreeNode.html",
	"dijit/registry",
	"dijit/Tree",
	"./CheckBox",
	"./StoreModel"
], function ( array, declare, event, lang, win, dom, domAttr, domClass, domConstruct, domProp, domStyle, 
							NodeTemplate, registry, Tree, CheckBox, StoreModel ) {

	var TreeNode = declare([Tree._TreeNode], {
		// templateString: String
		//		Specifies the HTML template to be used.
		templateString: NodeTemplate,

		iconClass: "",	// override default dijitNoIcon

		// _checkBox: [private] widget 
		//		Checkbox or custome widget instance.
		_checkBox: null,

		// _icon: [private] Object
		//		Custom icon associated with the tree node. If none is specified the
		//		default dijit tree icons are used.
		_icon: null,

		// _iconAttrMap: [private]
		//		List of supported and settable icon attributes. If a icon attribute is
		//		specified with value 'null' it indicates the attribute is not settable.
		_iconAttrMap: { iconClass: 'IconClass', style: 'IconStyle', baseClass: null, custom: null },
		
		// _toggle: [private] Boolean
		//		Indicates if the checkbox widget supports the toggle function.
		_toggle: true,
		
		// _widget: [private] Function
		//		Specifies the widget to be instanciated for the tree node. The default
		//		is the cbtree CheckBox widget.
		_widget: CheckBox,
		
		// _widgetArgs: [private] Object
		//		Set of default attributes which will be passed to the checkbox or custom
		//		widget constructor.
		_widgetArgs: null,
									 
		constructor: function( args ){
			// summary:
			//		If a custom widget is specified, it is used instead of the default
			//		cbtree checkbox. Any optional arguments are appended to the default
			//		widget argument list. (see _widgetArgs).

			this._widgetArgs = { multiState: null, checked: true, value:'on' };
			this._icon = { iconClass: null, baseClass: null, orgClass: null, indent: true, custom: false };

			if (args.widget) {
				this._widget = args.widget.widget;
				if (args.widget.attr) {
					for(var attr in args.widget.attr) {
						this._widgetArgs[attr] = args.widget.attr[attr];
					}
				}
				// Test if the widget supports the toggle() method.
				this._toggle = lang.isFunction( this._widget.prototype.toggle );
			}
		},

		_applyClassAndStyle: function( /*StoreItem*/ item, /*String*/ attribute){
			// summary:
			//		Set the appropriate CSS classes and styles for labels, icons and rows.
			// item:
			//		The dojo.data.store item (void)
			// attribute:
			//		The lower case attribute name to use, e.g. 'icon', 'label' or 'row'.
			// tags:
			//		private
			var newClass, newStyle, className, styleName, nodeName;
			
			className = attribute + "Class";
			styleName = attribute + "Style";
			nodeName	= attribute + "Node";

			newClass	= (this.get(className) || "");
			if (this[className] !== newClass) {
				domClass.replace(this[nodeName], newClass, this[className] || "");
				this[className] = newClass;
			}
			newStyle = (this.get(styleName) || {});
			domStyle.set(this[nodeName], newStyle);
			this[styleName] = newStyle;			
		},
		
		_createCheckBox: function (/*Boolean*/ multiState ) {
			// summary:
			//		Create a checkbox on the TreeNode if a checkbox style is specified.
			// description:
			//		Create a checkbox on the tree node. A checkbox is only created if
			//		a valid 'checked' attribute was found in the dojo.data store OR the
			//		attribute 'checkboxAll' equals true.
			//
			// multiState:
			//			Indicate of multi state checkboxes are to be used (true/false).
			// tags:
			//		private

			var checked = this.tree.model.getItemAttr( this.item, "checked" );
			if ( checked !== undefined ) {
				// Initialize the default checkbox/widget attributes.
				this._widgetArgs.multiState = multiState;
				this._widgetArgs.checked		= checked;
				this._widgetArgs.value			= this.label;
				
				this._checkBox = new this._widget( this._widgetArgs );
				domConstruct.place(this._checkBox.domNode, this.checkBoxNode, 'replace');
			}
			if ( this._checkBox ) {
				if ( this.isExpandable && this.tree.branchReadOnly ) {
					this._checkBox.set( "readOnly", true );
				}
			}
		},

		_getCheckedAttr: function() {
			// summary:
			//		Get the current checkbox state. This method provides the hook for
			//		get("checked").
			// tags:
			//		private
			
			if ( this._checkBox ) {
				return this.tree.model.getItemAttr( this.item, "checked");
			}
		},

		_getIconAttr: function() {
			// summary:
			//		Returns the custom icon associated with the tree node. If no icon is
			//		set the custom icon for the tree is returned if any. This method is
			//		the hook for get("icon").
			// tags:
			//		private
			return this._icon ? this._icon : this.tree._icon;
		},

		_getIconClassAttr: function() {
			// summary:
			//		Return the css class(es) for the node Icon. This method is the hook for
			//		get("iconClass");
			// description:
			//		Return the css class(es) for the node Icon. If custom icons are enabled,
			//		the base class returned is either: 'Expanded', 'Collapsed' or 'Terminal'
			//		prefixed with the custom icon class. If custom icon indentation is true
			//		an additional class is returned which is the base class suffixed with 
			//		the current indent level. If custom icons are disabled the default dijit
			//		css class(es) are returned. 
			// tags:
			//		private

			var iconClass	= this._icon.iconClass,
					newClass;

			if (!iconClass) {
				iconClass = domProp.get( this.iconNode,"className" );
				this._icon.iconClass	= iconClass;
				this._icon.orgClass		= iconClass;
			}
			// Default dijit tree icon(s)
			if (!this._icon.custom) {
				newClass = (this.isExpandable ? (this.isExpanded ? "dijitFolderOpened" : "dijitFolderClosed") : "dijitLeaf");
				return iconClass + ' ' + newClass;
			}
			// Handle custom icons...
			var baseClass = this._icon.baseClass,
					indent = this._icon.indent;

			if (!this._icon.fixed) {
				newClass = baseClass + (this.isExpandable ? (this.isExpanded ? "Expanded" : "Collapsed") : "Terminal");
				if ( indent !== undefined && indent !== false ) {
					// Test boolean versus numeric
					if ( indent === true || indent >= this.indent ) {
						newClass += ' ' + newClass + '_' + this.indent;
					}
				}
			} else {
				newClass = this._icon.fixed;
			}
			return iconClass + ' ' + newClass;
		},

		_getIconStyleAttr: function() {
			// summary:
			//		Return the DOM style for the node Icon. This method is the hook for
			//		get("iconStyle").
			// description:
			//		Return the DOM style for the node Icon. If a style object for the
			//		custom icons was specified is it returned.
			// tags:
			//		private

			var style = this._icon.style || {};
			if ( this.isExpandable ) {
				if ( !this.tree.branchIcons ) {
					style["display"] = "none";
				}
			} else {
				if ( !this.tree.nodeIcons ) {
					style["display"] = "none";
				}
			}
			return style;
		},
 
		_onClick: function (/*Event*/ evt){
			// summary:
			//		Handler for onclick event on a tree node
			// description:
			//		If the click event occured on a checkbox, get the new checkbox checked
			//		state, update the store and generate the checkbox click related events
			//		otherwise pass the event on to the tree as a regular click event.
			// evt:
			//		Event object.
			// tags:
			//		private

			if (evt.target.nodeName == (this._widgetArgs.target || 'INPUT')) {
				var newState = this._checkBox.get("checked");
				this.tree.model.setItemAttr( this.item, "checked", newState );
				this.tree._onCheckBoxClick( this, newState, evt );
			} else {
				this.tree._onClick(this, evt);
			}
		},

		_revertIconClass: function( icon ) {
			// summary:
			//		Revert back to the previous icon css class. Whenever set("iconClass",..)
			//		is called with an empty class name string we revert back to the previous
			//		class name, that is, if one is available.
			// icon:
			//		Object
			// tag:
			//		private.
			
			if (icon.orgClass) {
				icon.iconClass = icon.orgClass;
				icon.baseClass = null;
				icon.custom = false;
				icon.fixed  = false;
				this._setAttributeClass( "icon", icon.orgClass );
			}
			return icon.OrgClass;
		},
		
		_setAttributeClass: function(/*String*/ attr, /*String*/ cssClass ) {
			// summary:
			//		Set the css class for the icon, label or row.
			// attr:
			//		Name of the tree node attribute like icon, label or row.
			// cssClass:
			//		css class name(s)
			// tags:
			//		private

			if (lang.isString(cssClass)) {
				var nodeName	= attr + "Node";		 
				var oldClass	= domProp.get( this[nodeName],"className" );				

				domClass.replace( this[nodeName], cssClass, (oldClass || "") );
				this._applyClassAndStyle( this.item, attr );
				return cssClass;
			}
			throw new TypeError(this.declaredClass+"::_setAttributeClass(): argument must be a string");
		},

		_setAttributeStyle: function(/*String*/ attr, /*Object*/ style ) {
			// summary:
			//		Set the css style for the icon, label or row.
			// attr:
			// style:
			//		Object suitable for input to domStyle.set() like {color: "red", background: "green"}
			// tags:
			//		private

			var styleName = attr + 'Style';
			
			if (lang.isObject( style )) {
				this[styleName] = style;
				this._applyClassAndStyle( this.item, attr );
				return this.get(styleName);
			}
			throw new TypeError(this.declaredClass+"::_setAttributeStyle(): argument must be an object");
		},

		_setCheckedAttr: function (/*String|Boolean*/ newState) {
			// summary:
			//		Set a new state for the tree node checkbox. This method implements
			//		the set("checked", newState). These requests are recieved from the
			//		API and therefore we need to inform the model.
			//	newState:
			//		The checked state: 'mixed', true or false.
			// tags:
			//		private

			if ( this._checkBox ) {
				return this.tree.model.setItemAttr( this.item, "checked", newState );
			}
		},

		_set_checked_Attr: function( newState ) {
			// summary:
			//		Set a new state for the tree node checkbox. This method handles the
			//		internal '_checked_' events generated by the model in which case we
			//		only need to update the checkbox.
			//	newState:
			//		The checked state: 'mixed', true or false.
			// tags:
			//		private
			if ( this._checkBox ) {
				this._checkBox.set("checked", newState );
			}
		},
		
		_setIconAttr: function (/*String|*Object*/ icon) {
			// summary:
			//		Set a custom icon for the tree node.
			// icon:
			//		A string specifying the css class of the icon or an object with two
			//		properties: {cssClass: /*string*/, indent: /*boolean*/ }
			// tags:
			//		private
			
			var icon = this.tree._icon2Object(icon),
					camelCase,
					setter,
					attr;
			
			this._icon.indent = true;
			this._icon.fixed  = false;
			
			for (attr in icon) {
				camelCase = this._iconAttrMap[attr];
				if( camelCase ) {
					setter = '_set' + camelCase + 'Attr';
					if (this[setter] && lang.isFunction(this[setter])) {
						this[setter](icon[attr]);
					} else {
						throw new Error( this.declaredClass+"::_setIconAttr(): declared setter: {"+setter+"} is missing." );
					}
				} else {
					if( camelCase === undefined )
					{
						// No setter but not disallowed.
						this._icon[attr] = icon[attr];
					}
				}
			}
			this._applyClassAndStyle( this.item, "icon" );
			return this._icon;
		},

		_setIconClassAttr: function (/*String*/ cssClass ) {
			// summary:
			//		Remove all existing css classes and replace it with the custom icon
			//		base class and re-apply the node specific classes.

			// Ignore all set("iconClass", ...) calls until we entered the start of postCreate().
			if( !this._giddyUp ) { return; }	

			if (lang.isString(cssClass)) {
				var classes = lang.trim( cssClass ).split( /\s+/ );
				if( classes[0] ) {
					if (cssClass !== this.iconClass){
							this._icon.orgClass 	= this._icon.iconClass;
							this._icon.iconClass	= cssClass;
							this._icon.baseClass	= classes[0];
							this._icon.custom		  = true;
							this._setAttributeClass( "icon", cssClass );
					}
					if( !this._icon.baseClass ) {
						this._icon.baseClass = classes[0];
					}
				} else {
					// If no css class is specified revert back to the original.
					return this._revertIconClass( this._icon );
				}
				return cssClass;
			}
			throw new TypeError(this.declaredClass+"::_setIconClassAttr(): argument must be a string");
		},

		_setIconStyleAttr: function(/*Object*/ style ) {
			// summary:
			//		Set the css style attributes for the tree node icon.
			if (lang.isObject(style)) {
				if( !this._icon ) {
					this._icon = {};
				}
				this._icon.style = style;
				return this._setAttributeStyle( "icon", style );
			}
			throw new TypeError(this.declaredClass+"::_setIconStyleAttr(): argument must be an object");
		},

		_setLabelClassAttr: function (/*String*/ cssClass ) {
			return this._setAttributeClass( "label", cssClass );
		},

		_setLabelStyleAttr: function (/*Object*/ style ) {
			return this._setAttributeStyle( "label", style );
		},

		_setRowClassAttr: function (/*String*/ cssClass ) {
			return this._setAttributeClass( "row", cssClass );
		},

		_setRowStyleAttr: function (/*Object*/ style) {
			return this._setAttributeStyle( "row", style );
		},

		_setNodeIconAll: function(/*Object*/ icon ) {
			// summary:
			//		Set the icon class for all tree nodes. This method is only called
			//		when custom icons are applied dynamically using set("icon",...) on 
			//		the tree for example: tree.set("icon",myIcon) or tree.setIcon(myIcon)
			// icon:
			//		A string specifying the css class of the icon or an object with two
			//		properties: {iconClass: /*string*/, indent: /*boolean*/ }
			// tags:
			//		private

			this.set("icon", icon);
			array.forEach( this.getChildren(), function(child) {
						child._setNodeIconAll(icon);
					});		 
		},
		
		_toggleCheckBox: function (){
			// summary:
			//		Toggle the current checkbox checked attribute and update the store
			//		accordingly. Typically called when the spacebar is pressed. 
			//		If a custom widget does not support toggle() we will just mimic it.
			// tags:
			//		private

			var newState, oldState;
			if ( this._checkBox ) {
				if (this._toggle) {
					newState = this._checkBox.toggle();
				} else {
					oldState = this._checkBox.get("checked");
					newState = (oldState == "mixed" ? true : !oldState);
				}
				this.tree.model.setItemAttr( this.item, "checked", newState );
			}
			return newState;
		},
		
		destroy: function () {
			// summary:
			//		Destroy the checkbox of the tree node widget.
			//
			if ( this._checkbox ) {
				this._checkbox.destroy();
			}
			this.inherited(arguments);
		},

		postCreate: function () {
			// summary:
			//		Handle the creation of the checkbox after the tree node has been
			//		instanciated.
			// description:
			//		Handle the creation of the checkbox after the tree node has been
			//		instanciated. If a custom icon is specified for the tree, set it
			//		here removing the default 'dijit' classes. (see template).
			//
			var tree	= this.tree,
					storeIcon = null,
					nodeIcon;

			this._giddyUp = true;
			
			if ( tree.checkboxStyle !== "none" ) {
				this._createCheckBox( tree._multiState );
			}
			if (tree.iconAttr){
				storeIcon = tree.model.getItemAttr( this.item, tree.iconAttr );
				storeIcon = tree._icon2Object( storeIcon );
			}
			nodeIcon = storeIcon || this.tree._icon;
			if (nodeIcon) {
				this.set( "icon", nodeIcon );
			}
			// Just in case one is available, set the tooltip.
			this.set("tooltip", this.title );
			this.inherited( arguments );
		}
		
	});	/* end declare() _TreeNode*/


	return declare( [Tree], {
		// branchIcons: Boolean
		//		Determines if the FolderOpen/FolderClosed icon or their custom equivalent
		//		is displayed.
		branchIcons: true,

		// branchReadOnly: Boolean
		//		Determines if branch checkboxes are read only. If true, the user must
		//		check/uncheck every child checkbox individually. 
		branchReadOnly: false,
		
		// checkboxStyle: String
		//		Sets the style of the checkbox to be used. Currently only "none" has
		//		any impact. 
		checkboxStyle: null,

		// iconAttr: String
		//		Identifies a store item property/attribute the tree needs to act upon as
		//		being a custom icon.
		iconAttr: null,

		// nodeIcons: Boolean
		//		Determines if the Leaf icon, or its custom equivalent, is displayed.
		nodeIcons: true,

		// _icon: [private] String|Object
		//		If _icon is specified the default dijit icons 'Open' 'Closed' and 'Leaf'
		//		will be replaced with a custom icon sprite with three distinct css classes:
		//		'Expanded', 'Collapsed' and 'Terminal'.
		_icon: null,
		
		// _labelAttr:	[private] String
		//		Identifies the label attribute used by the model, that is, if available.
		_labelAttr: null,
		
		// _multiState: [private] Boolean
		//		Determines if the checked state needs to be maintained as multi state or
		//		or as a dual state. ({"mixed",true,false} vs {true,false}). Its value is
		//		fetched from the tree model.
		_multiState: true,
		
		// _checkedAttr: [private] String
		//		Attribute name associated with the checkbox checked state in the store.
		//		The value is retrieved from the models 'checkedAttr' property and added
		//		to the list of store events.
		_checkedAttr: "",
		
		// _customWidget: [private]
		//		A custome widget to be used instead of the cbtree CheckBox widget. Any 
		//		custom widget MUST have a 'checked' property and provide support for 
		//		both the get() and set() methods.
		_customWidget: null,

		// storeEvents: [private] array of strings
		//		List of additional events (attribute names) the onItemChange() method
		//		will act upon besides the _checkedAttr property value.	 Any internal
		//		events are pre- and suffixed with an underscore like '_icon_'
		_storeAttrMap: {},

		// _writeEnabled: [private]
		//		Indicate if the underlying model support tree.model.setItemAttr operations.
		_writeEnabled: false,
		
	 
		_createTreeNode: function ( args ) {
			// summary:
			//		Create a new cbtreeTreeNode instance.
			// description:
			//		Create a new cbtreeTreeNode instance.
			// tags:
			//		private

			args["widget"] = this._customWidget;		/* Mixin the custom widget */
			return new TreeNode( args );
		},

		_onCheckBoxClick: function (/*TreeNode*/ nodeWidget, /*Boolean|String*/ newState, /*Event*/ evt) {
			// summary:
			//		Translates checkbox click events into commands for the controller
			//		to process.
			// description:
			//		the _onCheckBoxClick function is called whenever a mouse 'click'
			//		on a checkbox is detected. Because the click was on the checkbox
			//		we are not dealing with any node expansion or collapsing here.
			// tags:
			//		private

			var storeItem = nodeWidget.item;
				
			this._publish("execute", { item: storeItem, node: nodeWidget, evt: evt} );
			// Generate events incase any listeners are tuned in...
			this.onCheckBoxClick( storeItem, nodeWidget, evt );
			this.onClick(nodeWidget.item, nodeWidget, evt);
			this.focusNode(nodeWidget);
			event.stop(evt);
		},

		_onItemChange: function(/*dojo.data.Item*/ storeItem, /*String*/ attr, value){
			// summary:
			//		Processes notification of a change to a store item's scalar values.
			// description:
			//		Processes notification of a change to a store item's scalar values like
			//		label or checkbox state but first check if we are actually interested 
			//		in the type of attribute that triggered the event as it may not impact
			//		the tree at all.
			//
			//	IMPORTANT:
			//		In case of a checkbox update event we call the set() method of the
			//		checkbox direct as node.set("checked",value) would go back to the
			//		model again.
			// tags:
			//		private
 
			var nodeProp = this._storeAttrMap[attr];
			if ( nodeProp ) {
				var identity = this.model.getIdentity(storeItem),
						nodes = this._itemNodesMap[identity],
						request = {};

				if (nodes){
					request[nodeProp] = value;
					array.forEach(nodes, function(node){
							node.set( request );
						}, this );
				}
			}
		},

		_onKeyPress: function (/*Event*/ evt){
			// summary:
			//		Toggle the checkbox state when the user pressed the spacebar.
			// description:
			//		Toggle the checkbox state when the user pressed the spacebar.
			//		The spacebar is only processed if the widget that has focus is
			//		a tree node and has a checkbox.
			// tags:
			//		private

			if ( !evt.altKey ) {
				var treeNode = registry.getEnclosingWidget(evt.target);
				if (lang.isString(evt.charOrCode) && (evt.charOrCode == ' ')) {
					treeNode._toggleCheckBox();
				}
			}
			this.inherited(arguments);	/* Pass it on to the parent tree... */
		},

		_onStoreValidated: function () {
			// summary:
			//		Handler called when store validation has completed. Get the store 
			//		label attribute and add it to the list of attributes that will be
			//		monitored.
			
			this._labelAttr = this.model.get("labelAttr");
			this.mapStoreAttr( this._labelAttr || "label", "label" );
		},
		
		_setIconAttr: function (/*string|object*/ icon ) {
			// summary:
			//		Hook for the set("icon",customIcon) method and allows for dynamic
			//		changing of the tree node icons. If icon if a valid argument all
			//		icon related information for every tree node is updated.
			//
			//		NOTE: No matter what the custom icon is, the associated css file(s)
			//					MUST have been loaded prior to setting the new icon.
			// icon:
			//		A string specifying the css class of the icon or an object with two
			//		properties: {iconClass: /*string*/, indent: /*boolean*/ }
			// tags:
			//		private
			
			this._icon = this._icon2Object( icon );
			// During tree instantiation there is no root node.
			if (this._icon && this.rootNode) {
				this.rootNode._setNodeIconAll( this._icon );
			}
		},

		_setWidgetAttr: function(/*function|object*/ widget ) {
			// summary:
			//		Set the custom widget. This method is the hook for set("widget",widget).
			// description:
			//		Set the custom widget. A valid widget MUST have a 'checked' property
			//		AND methods get() and set() otherwise the widget is rejected and an
			//		error is thrown.
			// widget: 
			//		An object or function. In case of an object, the object can have the
			//		following properties:
			//			widget:	 Function, the widget constructor.
			//			attr:		 Object, arguments passed to the constructor (optional)
			//			target:	 String, target nodename (optional)
			// tag:
			//		experimental
			var customWidget = widget,
					property = "checked",
					message,
					proto;

			if (lang.isString(widget)) {
				return this._setWidgetAttr( { widget: widget } );
			}

			if (lang.isObject(widget) && widget.hasOwnProperty( "widget" ) ) {
				customWidget = widget.widget;
				if (lang.isFunction(customWidget)) {
					proto = customWidget.prototype;
					if( proto && typeof proto[property] !== "undefined" ){
						// See if the widget has a getter and setter methods...
						if( lang.isFunction( proto.get ) && lang.isFunction( proto.set ) ) {
							this._customWidget = widget;
							return true;
						} else {
							message = "Widget does not support get() and/or set()";
						}
					} else {
						message = "widget MUST have a 'checked' property";
					}
				}else{
					message = "argument is not a valid Widget";
				}
			} else {
				message = "Object is missing required widget property";
			}
			throw new Error(this.declaredClass+"::_setWidgetAttr(): " + message);
		},

		getIconClass: function(/*dojo.data.Item*/ item, /*Boolean*/ opened){
			// summary:
			//		Because the icons are now maintained at the tree node level it renders 
			//		this method Obsolete, use get("iconClass") on tree nodes.
			console.warn( this.declaredClass+"::getIconClass(): use get('iconClass') on a tree node instead" );
		},

		getIconStyle:function (/*dojo.data.Item*/ item, /*Boolean*/ opened) {
			// summary:
			//		Because the icons are now maintained at the tree node level it renders 
			//		this method Obsolete, use get("iconStyle") on tree nodes.
			console.warn( this.declaredClass+"::getIconStyle(): use get('iconStyle') on a tree node instead");
		},

		onCheckBoxClick: function (/*dojo.data.Item*/ storeItem, /*treeNode*/ treeNode, /*Event*/ evt) {
			// summary:
			//		Callback when a checkbox on a tree node is clicked.
			// tags:
			//		callback
		},
		
		postCreate: function () {
			// summary:
			//		Handle any specifics related to the tree and model after the
			//		instanciation of the Tree. 
			// description:
			//		Whenever checkboxes are requested Validate if we have a 'write'
			//		store first and kickoff the initial checkbox data validation.

			var model = this.model;

			if ( this.checkboxStyle !== "none" ) {
				// Get the checked state attribute name and add it to the front of the
				// store events list.
				this._writeEnabled = model.get("features")["tree.model.setItemAttr"];
				this._multiState	 = model.get("multiState");
				this._checkedAttr	= model.get("checkedAttr");

				// Add store item attributes and other attributes of interest to the
				// mapping table.   Note: a 'checked' event from the store is mapped
				// to the internal '_checked_' event so we can distinguesh between
				// store events and set("checked",..) events from the API.
				
				this.mapStoreAttr( (this._checkedAttr || "checked"), "_checked_" );
				this.mapStoreAttr( "label", "label" );
				this.mapStoreAttr( "_icon_", "icon" );
				if (this.iconAttr) {
					this.mapStoreAttr( this.iconAttr, "icon" );
				}

				if( !this._writeEnabled ) {
					console.warn(this.declaredClass+"::postCreate(): store model is not write enabled.");
				} else {
					this.connect(model, "onStoreComplete", "_onStoreValidated");
					model._validateData();
				}
			}
			this.inherited(arguments);
		},
		
		setIcon: function( /*String|Object*/ icon, /*dojo.data.item?*/ storeItem ) {
			// summary:
			//		Set a custom icon. If the storeItem argument is ommitted the icon is
			//		applied to all tree nodes otherwise to the specified store item only.
			// icon:
			//		A string specifying the css class of the icon or an object with two
			//		properties: {iconClass: /*string*/, indent: /*boolean*/ }
			// storeItem:
			//		A valid store item whose icon to set.
			
			var newIcon = this._icon2Object(icon);
			if (storeItem){
				if (this.model.isItem(storeItem)) {
					// Trigger an internal icon event.
					this._onItemChange( storeItem, "_icon_", newIcon );
				} else {
					throw new TypeError(this.declaredClass+"::setIcon(): invalid store item specified.");
				}
			} else {
				this.set( "icon", newIcon );
			}
		},

		// =======================================================================
		// Misc helper methods

		mapStoreAttr: function( /*String*/ attr, /*String*/ mapping ) {
			// summary:
			//		Append attribute mapping to the mapping table.
			if (lang.isString(attr) && lang.isString(mapping)) {
				this._storeAttrMap[attr] = mapping;
			}
		},
		
	 _icon2Object: function( /*String|Object*/ icon ) {
			// summary:
			//		Convert a string argument into an icon object. If icon is already an
			//		object it is tested for the minimal required properties.
			// icon:
			//		A string specifying the css class of the icon or an object with at
			//		a minimum the property 'iconClass'.
			// tags:
			//		private
			if (icon) {
				if (!lang.isObject(icon)) {
					if (lang.isString(icon) && icon.length ) {
						return { iconClass: icon, indent: true, style: {} };
					} else {
						throw new TypeError(this.declaredClass+"::_icon2Object(): icon must be an object or string");
					}
				} else {
					if (icon.iconClass && icon.iconClass.length) {
						return icon;
					}
					throw new Error(this.declaredClass+"::_icon2Object(): required property 'iconClass' is missing or empty");
				}
			}
			return null;
		}
		
	});	/* end declare() Tree */

});	/* end define() */
