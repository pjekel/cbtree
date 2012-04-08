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
	"dojo/dom-construct",
	"dojo/has",
	"dojo/text!./templates/cbtreeNode.html",
	"dijit/registry",
	"dijit/Tree",
	"./CheckBox",
	"./StoreModel"
], function (array, declare, event, lang, win, domConstruct, has, NodeTemplate, registry, Tree, 
							 CheckBox, StoreModel) {

	var TreeNode = declare([Tree._TreeNode], {
		// templateString: String
		//		Specifies the HTML template to be used.
		templateString: NodeTemplate,

		// _checkBox: [private] widget 
		//		Checkbox or custome widget instance.
		_checkBox: null,

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
									 
		constructor: function (args){
			// summary:
			//		If a custom widget is specified, it is used instead of the default
			//		cbtree checkbox. Any optional arguments are appended to the default
			//		widget argument list. (see _widgetArgs).

			var tree = args.tree;
			
			this._widgetArgs = { multiState: null, checked: true, value:'on' };
			if (args.widget) {
				this._widget = args.widget.widget;
				if (args.widget.attr) {
					for(var attr in args.widget.attr) {
						this._widgetArgs[attr] = args.widget.attr[attr];
					}
				}
			}
			// Test if the widget supports the toggle() method.
			this._toggle = lang.isFunction (this._widget.prototype.toggle);
		},

		_createCheckBox: function (/*Boolean*/ multiState) {
			// summary:
			//		Create a checkbox on the TreeNode if a checkbox style is specified.
			// description:
			//		Create a checkbox on the tree node. A checkbox is only created if
			//		the data item has a valid 'checked' attribute OR the model has the
			//		'checkboxAll' attribute enabled.
			//
			// multiState:
			//			Indicate of multi state checkboxes are to be used (true/false).
			// tags:
			//		private

			var checked = this.tree.model.getItemAttr(this.item, "checked");
			if (checked !== undefined) {
				// Initialize the default checkbox/widget attributes.
				this._widgetArgs.multiState = multiState;
				this._widgetArgs.checked		= checked;
				this._widgetArgs.value			= this.label;
				
				this._checkBox = new this._widget(this._widgetArgs);
				domConstruct.place(this._checkBox.domNode, this.checkBoxNode, 'replace');
			}
			if (this._checkBox) {
				if (this.isExpandable && this.tree.branchReadOnly) {
					this._checkBox.set("readOnly", true);
				}
			}
		},

		_getCheckedAttr: function () {
			// summary:
			//		Get the current checkbox state. This method provides the hook for
			//		get("checked").
			// tags:
			//		private
			
			if (this._checkBox) {
				return this.tree.model.getItemAttr(this.item, "checked");
			}
		},

		_onClick: function (/*Event*/ evt){
			// summary:
			//		Handler for onclick event on a tree node
			// description:
			//		If the click event occured on a checkbox, get the new checkbox checked
			//		state, update the model and generate the checkbox click related events
			//		otherwise pass the event on to the tree as a regular click event.
			// evt:
			//		Event object.
			// tags:
			//		private extension

			if (evt.target.nodeName == (this._widgetArgs.target || 'INPUT')) {
				var newState = this._checkBox.get("checked");
				this.tree.model.setItemAttr(this.item, "checked", newState);
				this.tree._onCheckBoxClick(this, newState, evt);
			} else {
				this.tree._onClick(this, evt);
			}
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

			if (this._checkBox) {
				return this.tree.model.setItemAttr(this.item, "checked", newState);
			}
		},

		_set_checked_Attr: function (newState) {
			// summary:
			//		Set a new state for the tree node checkbox. This method handles the
			//		internal '_checked_' events generated by the model in which case we
			//		only need to update the checkbox.
			//	newState:
			//		The checked state: 'mixed', true or false.
			// tags:
			//		private
			if (this._checkBox) {
				this._checkBox.set("checked", newState);
			}
		},
		
		_toggleCheckBox: function (){
			// summary:
			//		Toggle the current checkbox checked attribute and update the model
			//		accordingly. Typically called when the spacebar is pressed. 
			//		If a custom widget does not support toggle() we will just mimic it.
			// tags:
			//		private

			var newState, oldState;
			if (this._checkBox) {
				if (this._toggle) {
					newState = this._checkBox.toggle();
				} else {
					oldState = this._checkBox.get("checked");
					newState = (oldState == "mixed" ? true : !oldState);
				}
				this.tree.model.setItemAttr(this.item, "checked", newState);
			}
			return newState;
		},
		
		destroy: function () {
			// summary:
			//		Destroy the checkbox of the tree node widget.
			//
			if (this._checkbox) {
				this._checkbox.destroy();
			}
			this.inherited(arguments);
		},

		postCreate: function () {
			// summary:
			//		Handle the creation of the checkbox and node specific icons after
			//		the tree node has been instanciated.
			// description:
			//		Handle the creation of the checkbox after the tree node has been
			//		instanciated. If the item has a custom icon specified, overwrite
			//		the current icon.
			//
			var tree	= this.tree,
					itemIcon = null,
					nodeIcon;

			if (tree.checkboxStyle !== "none") {
				this._createCheckBox(tree._multiState);
			}
			// See is Tree styling is loaded...
			if (tree._treeStyling && tree.iconAttr) {
				var itemIcon = tree.get("icon", this.item);
				if (!itemIcon || !itemIcon.baseClass) {
					itemIcon = tree.model.getItemAttr(this.item, tree.iconAttr);
					if (itemIcon) {
						this.tree.set("icon", itemIcon, this.item);
					}
				}
			}
			// Just in case one is available, set the tooltip.
			this.set("tooltip", this.title);
			this.inherited(arguments);
		}

		// =======================================================================
		// Misc TreeNode helper functions/methods

	});	/* end declare() _TreeNode*/


	return declare([Tree], {
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

		// nodeIcons: Boolean
		//		Determines if the Leaf icon, or its custom equivalent, is displayed.
		nodeIcons: true,

		// _labelAttr:	[private] String
		//		Identifies the label attribute used by the model, that is, if available.
		_labelAttr: null,
		
		// _multiState: [private] Boolean
		//		Determines if the checked state needs to be maintained as multi state or
		//		or as a dual state. ({"mixed",true,false} vs {true,false}). Its value is
		//		fetched from the tree model.
		_multiState: true,
		
		// _checkedAttr: [private] String
		//		Attribute name associated with the checkbox checked state of a data item.
		//		The value is retrieved from the models 'checkedAttr' property and added
		//		to the list of model events.
		_checkedAttr: "",
		
		// _customWidget: [private]
		//		A custom widget to be used instead of the cbtree CheckBox widget. Any 
		//		custom widget MUST have a 'checked' property and provide support for 
		//		both the get() and set() methods.
		_customWidget: null,

		// _modelAttrMap: [private] array of strings
		//		List of additional events (attribute names) the onItemChange() method
		//		will act upon besides the _checkedAttr property value.	 Any internal
		//		events are pre- and suffixed with an underscore like '_styling_'
		_modelAttrMap: {},

		// _writeEnabled: [private]
		//		Indicate if the underlying model support tree.model.setItemAttr operations.
		_writeEnabled: false,
		
	 
		_createTreeNode: function (args) {
			// summary:
			//		Create a new cbtreeTreeNode instance.
			// description:
			//		Create a new cbtreeTreeNode instance.
			// tags:
			//		private

			args["widget"] = this._customWidget;		/* Mixin the custom widget */
			if (this._treeStyling) {
				args["icon"]   = this._icon;
			}
			return new TreeNode(args);
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

			var item = nodeWidget.item;
				
			this._publish("checkbox", { item: item, node: nodeWidget, state: newState, evt: evt});
			// Generate events incase any listeners are tuned in...
			this.onCheckBoxClick(item, nodeWidget, evt);
			this.onClick(nodeWidget.item, nodeWidget, evt);
			this.focusNode(nodeWidget);
			event.stop(evt);
		},

		_onItemChange: function (/*data.Item*/ item, /*String*/ attr, /*AnyType*/ value){
			// summary:
			//		Processes notification of a change to an data item's scalar values and
			//		internally generated events which effect the presentation of an item.
			// description:
			//		Processes notification of a change to a data item's scalar values like
			//		label or checkbox state.  In addition, it also handles internal events
			//		that effect the presentation of an item.
			//		The model, or internal, attribute name is mapped to a tree node property,
			//		only if a mapping is available is the event passed on to the appropriate
			//		tree node otherwise the event is considered of no impact to the tree
			//		presentation.
			// item:
			//		A valid data item
			// attr:
			//		Attribute name
			// value:
			//		New value of the item attribute
			// tags:
			//		private extension
 
			var nodeProp = this._modelAttrMap[attr];
			if (nodeProp) {
				var identity = this.model.getIdentity(item),
						nodes = this._itemNodesMap[identity],
						request = {};

				if (nodes){
					request[nodeProp] = value;
					array.forEach(nodes, function (node){
							node.set(request);
						}, this);
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
			//		private extension

			if (!evt.altKey) {
				var treeNode = registry.getEnclosingWidget(evt.target);
				if (lang.isString(evt.charOrCode) && (evt.charOrCode == ' ')) {
					treeNode._toggleCheckBox();
				}
			}
			this.inherited(arguments);	/* Pass it on to the parent tree... */
		},

		_onModelValidated: function () {
			// summary:
			//		Handler called when the model has completed the validation of the
			//		unlying data store. Get the name of what is considered the label
			//		attribute and add it to the attribute mapping list.
			
			this._labelAttr = this.model.get("labelAttr");
			this.mapModelAttr((this._labelAttr || "label"), "label");
		},
		
		_setWidgetAttr: function (/*function|object*/ widget) {
			// summary:
			//		Set the custom widget. This method is the hook for set("widget",widget).
			// description:
			//		Set the custom widget. A valid widget MUST have a 'checked' property
			//		AND methods get() and set() otherwise the widget is rejected and an
			//		error is thrown. If valid, the widget is used instead of the default
			//		cbtree checkbox.
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
				return this._setWidgetAttr({ widget: widget });
			}

			if (lang.isObject(widget) && widget.hasOwnProperty("widget")) {
				customWidget = widget.widget;
				if (lang.isFunction (customWidget)) {
					proto = customWidget.prototype;
					if (proto && typeof proto[property] !== "undefined"){
						// See if the widget has a getter and setter methods...
						if (lang.isFunction (proto.get) && lang.isFunction (proto.set)) {
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

		onCheckBoxClick: function (/*data.item*/ item, /*treeNode*/ treeNode, /*Event*/ evt) {
			// summary:
			//		Callback when a checkbox on a tree node is clicked.
			// tags:
			//		callback
		},
		
		getIconStyle:function (/*data.item*/ item, /*Boolean*/ opened) {
			// summary:
			//		Return the DOM style for the node Icon. 
			// item:
			//		A valid data item
			// opened:
			//		Indicates if the tree node is expanded.
			// tags:
			//		extension
			var isExpandable = this.model.mayHaveChildren(item);
			var style = this.inherited(arguments) || {};

			if (isExpandable) {
				if (!this.branchIcons) {
					style["display"] = "none";
				}
			} else {
				if (!this.nodeIcons) {
					style["display"] = "none";
				}
			}
			return style;
		},

		postCreate: function () {
			// summary:
			//		Handle any specifics related to the tree and model after the
			//		instanciation of the Tree. 
			// description:
			//		Whenever checkboxes are requested Validate if we have a model
			//		capable of updating item attributes.

			var model = this.model;

			if (this.checkboxStyle !== "none") {
				this._multiState   = model.get("multiState");
				this._checkedAttr  = model.get("checkedAttr");

				// Add item attributes and other attributes of interest to the mapping
				// table. Checkbox checked events from the model are mapped to the 
				// internal '_checked_' event so we are able to distinguesh between
				// events coming from the model and those coming from the API like
				// set("checked",true)
				
				this.mapModelAttr((this._checkedAttr || "checked"), "_checked_");
				this.mapModelAttr("label", "label");

				// Test available feature sets...
				this._writeEnabled = has("tree-model-setItemAttr");
				this._treeStyling  = has("tree-custom-styling");
				if (this._treeStyling) {
						this.mapModelAttr("_styling_", "styling");
					if (this.iconAttr) {
						this.mapModelAttr(this.iconAttr, "icon");
					}
				}
				
				if (!this._writeEnabled) {
					console.warn(this.declaredClass+"::postCreate(): store model is not write enabled.");
				} else {
					this.connect(model, "onStoreComplete", "_onModelValidated");
					model._validateData();
				}
			}
			this.inherited(arguments);
		},
		
		// =======================================================================
		// Misc helper functions/methods

		mapModelAttr: function (/*String*/ attr, /*String*/ mapping) {
			// summary:
			//		Append attribute mapping to the mapping table.
			// attr:
			//		Original attribute name
			// mapping:
			//		Mapped attribute name
			
			if (lang.isString(attr) && lang.isString(mapping)) {
				this._modelAttrMap[attr] = mapping;
			}
		}
		
	});	/* end declare() Tree */

});	/* end define() */
