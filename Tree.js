//
// Copyright (c) 2010-2012, Peter Jekel
// All rights reserved.
//
//  The Checkbox Tree (cbtree), also known as the 'Dijit Tree with Multi State Checkboxes'
//  is released under to following three licenses:
//
//  1 - BSD 2-Clause                (http://thejekels.com/js/cbtree/LICENSE)
//  2 - The "New" BSD License       (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//  3 - The Academic Free License   (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
//  In case of doubt, the BSD 2-Clause license takes precedence.
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
  "dojo/dom-style",
  "dojo/text!./templates/cbtreeNode.html",
  "dijit/registry",
  "dijit/Tree",
  "./CheckBox",
  "./StoreModel"
], function ( array, declare, event, lang, win, dom, domAttr, domClass, domConstruct, domStyle, 
              NodeTemplate, registry, Tree, CheckBox, StoreModel ) {

  var TreeNode = declare([Tree._TreeNode], {
    // templateString: String
    //    Specifies the HTML template to be used.
    templateString: NodeTemplate,

    // _checkBox: [private] widget 
    //    Checkbox or custome widget instance.
    _checkBox: null,

    // _icon: [private] Object
    //    Custom icon associated with the tree node. If none is specified the
    //    default dijit icons are used.
    _icon: null,
    
    // _toggle: [private] Boolean
    //    Indicates if the checkbox widget supports the toggle function.
    _toggle: true,
    
    // _widget: [private] Function
    //    Specifies the widget to be instanciated for the tree node. The default
    //    is the cbtree CheckBox widget.
    _widget: CheckBox,
    
    // _widgetArgs: [private] Object
    //    Set of default attributes which will be passed to the checkbox or custom
    //    widget constructor.
    _widgetArgs: { multiState: null, 
                   checked: true, 
                   value: 'on'},
                   
    // _widgetTarget: [private] String
    //    Specifies the event target nodename for the widget, that is, the value of
    //    evt.target.nodeName in a onClick event. The default is 'INPUT'
    _widgetTarget: 'INPUT',
    
    constructor: function( args ){
      // summary:
      //    If a custom widget is specified, it is used instead of the default
      //    cbtree checkbox. Any optional arguments are appended to the default
      //    widget argument list. (see _widgetArgs).
      if (args.widget) {
        this._widget = args.widget.widget;
        if(args.widget.target) {
          this._widgetTarget = args.widget.target;
        }
        if (args.widget.attr) {
          for(var attr in args.widget.attr) {
            this._widgetArgs[attr] = args.widget.attr[attr];
          }
        }
        // Test if the widget supports the toggle() method.
        this._toggle = lang.isFunction( this._widget.prototype.toggle );
      }
    },

    _applyClassAndStyle: function (/*dojo.data.Item*/ storeItem, /*String*/ lower, /*String*/ upper){
      // summary:
      //    Set the appropriate CSS classes and styles for labels, icons and rows.
      //    If custom icons have been specified fetch the icon info from the tree
      //    node instead of the tree.
      // storeItem:
      //    The data storeItem.
      // lower:
      //    The lower case attribute to use, e.g. 'icon', 'label' or 'row'.
      // upper:
      //    The upper case attribute to use, e.g. 'Icon', 'Label' or 'Row'.
      // tags:
      //    private

      var widget   = (lower == 'icon') ? this : this.tree;
      var clsName  = "_" + lower + "Class";
      var nodeName = lower + "Node";
      var oldCls   = this[clsName];

      this[clsName] = widget["get" + upper + "Class"](storeItem, this.isExpanded);
      domClass.replace(this[nodeName], this[clsName] || "", oldCls || "");
      domStyle.set(this[nodeName], widget["get" + upper + "Style"](storeItem, this.isExpanded, this) || {});
    },

    _createCheckBox: function (/*Boolean*/ multiState ) {
      // summary:
      //    Create a checkbox on the TreeNode if a checkbox style is specified.
      // description:
      //    Create a checkbox on the tree node. A checkbox is only created if
      //    a valid 'checked' attribute was found in the dojo.data store OR the
      //    attribute 'checkboxAll' equals true.
      //
      //  NOTE: The attribute 'checkboxAll' is validated by the model therefore
      //        no need to do it here.
      //
      // multiState:
      //      Indicate of multi state checkboxes are to be used (true/false).
      // tags:
      //    private

      var checked = this.tree.model.getItem( this.item, "checked" );
      if ( checked !== undefined ) {
        // Initialize the default checkbox attributes.
        this._widgetArgs.multiState = multiState;
        this._widgetArgs.checked    = checked;
        this._widgetArgs.value      = this.label;
        
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
      //    Get the current checkbox state. This method provides the hook for
      //    get("checked").
      // tags:
      //    private
      
      if ( this._checkBox ) {
        return this.tree.model.getItem( this.item, "checked");
      }
    },

    _getIconAttr: function() {
      // summary:
      //    Returns the custom icon associated with the tree node. This method
      //    is the hook for get("icon").
      // tags:
      //    private
      return this._icon ? this._icon : this.tree._icon;
    },

    _onClick: function (/*Event*/ evt){
      // summary:
      //    Handler for onclick event on a tree node
      // description:
      //    If the click event occured on a checkbox, get the new checkbox checked
      //    state, update the store and generate the checkbox click related events
      //    otherwise pass the event on to the tree as a regular click event.
      // evt:
      //    Event object.
      // tags:
      //    private

      if (evt.target.nodeName == this._widgetTarget) {
        var newState = this._checkBox.get("checked");
        this.tree.model.setItem( this.item, "checked", newState );
        this.tree._onCheckBoxClick( this, newState, evt );
      } else {
        this.tree._onClick(this, evt);
      }
    },

    _setCheckedAttr: function (/*String|Boolean*/ newState) {
      // summary:
      //    Set a new state for the tree node checkbox. This method implements
      //    the set("checked", newState).
      //  newState:
      //    The checked state: 'mixed', true or false.
      // tags:
      //    private

      if ( this._checkBox ) {
        return this.tree.model.setItem( this.item, "checked", newState );
      }
    },
    
    _setIconAttr: function (/*String|*Object*/ icon) {
      // summary:
      //    Associate a custom icon with the tree node. Remove all existing css
      //    classes and replace it with the custom icon base class and apply the
      //    node specific classes, that is, 'Expanded, Collapsed or Terminal'.
      // icon:
      //    A string specifying the css class of the icon or an object with two
      //    properties: {cssClass: /*string*/, indent: /*boolean*/ }
      // tags:
      //    private
      
      this._icon = this.tree._icon2Object(icon);
      domClass.replace( this.iconNode, this._icon.cssClass, (dom.byId( this.iconNode )["className"] || "") );
      this._applyClassAndStyle( this.item, "icon", "Icon" );
    },
    
    _setNodeIconAll: function(/*Object*/ icon ) {
      // summary:
      //    Set the icon class for all tree nodes. This method is only called
      //    when custom icons are applied dynamically using set("icon",...) on 
      //    the tree for example: tree.set("icon",myIcon) or tree.setIcon(myIcon)
      // icon:
      //    A string specifying the css class of the icon or an object with two
      //    properties: {cssClass: /*string*/, indent: /*boolean*/ }
      // tags:
      //    private

      this.set("icon", icon );
      array.forEach( this.getChildren(), function(child) {
            child._setNodeIconAll(icon);
          });     
    },
    
    _toggleCheckBox: function (){
      // summary:
      //    Toggle the current checkbox checked attribute and update the store
      //    accordingly. Typically called when the spacebar is pressed. 
      //    If a custom widget does not support toggle() we will just mimic it.
      // tags:
      //    private

      var newState, oldState;
      if ( this._checkBox ) {
        if (this._toggle) {
          newState = this._checkBox.toggle();
        } else {
          oldState = this._checkBox.get("checked");
          newState = (oldState == "mixed" ? true : !oldState);
        }
        this.tree.model.setItem( this.item, "checked", newState );
      }
      return newState;
    },
    
    destroy: function () {
      // summary:
      //    Destroy the checkbox of the tree node widget.
      //
      if ( this._checkbox ) {
        this._checkbox.destroy();
      }
      this.inherited(arguments);
    },

    getIconClass: function (/*dojo.data.Item*/ storeItem, /*Boolean*/ opened ){
      // summary:
      //    Return the css class(es) for the node Icon.
      // description:
      //    Return the css class(es) for the node Icon. If custom icons are enabled,
      //    the base class returned is either: 'Expanded', 'Collapsed' or 'Terminal'
      //    prefixed with the custom icon class. If custom icon indentation is true
      //    an additional class is returned which is the base class suffixed with 
      //    the current indent level. If custom icons are disabled the default dijit
      //    css class is returned. 
      // storeItem:
      //    A valid dojo.data.item
      // opened:
      //    Indicates if the tree node currently is expanded. (true/false)
      
      if (!this._icon) {
        return this.tree.getIconClass(storeItem,opened);
      }
      var iconIndent = this._icon.indent,
          iconClass  = this._icon.cssClass;
 
      iconClass += (this.isExpandable ? (this.isExpanded ? "Expanded" : "Collapsed") : "Terminal");
      if ( iconIndent !== undefined && iconIndent !== false ) {
        // Test boolean versus numeric
        if ( iconIndent === true || iconIndent >= this.indent ) {
          return ( iconClass + ' ' + iconClass + '_' + this.indent );
        }
      }
      return iconClass;
    },

    getIconStyle: function (/*dojo.data.Item*/ storeItem, /*Boolean*/ opened ){
      // summary:
      //    Return the DOM style for the node Icon.
      // description:
      //    Return the DOM style for the node Icon. If a style object for the
      //    custom icons was specified is it returned.
      // storeItem:
      //    A valid dojo.data.item
      // opened:
      //    Indicates if the tree node currently is expanded. (true/false)

      var style = this.tree.getIconStyle( storeItem, opened, this );
      if ( this._icon && this._icon.style ) {
        if ( typeof this._icon.style == "object" ) {
          for(var name in this._icon.style) {
            style[name] = this._icon.style[name];
          }
        }
      }
      return style;
    },

    postCreate: function () {
      // summary:
      //    Handle the creation of the checkbox after the tree node has been
      //    instanciated.
      // description:
      //    Handle the creation of the checkbox after the tree node has been
      //    instanciated. If a custom icon is specified for the tree, set it
      //    here and remove the default 'dijit' classes. (see template).
      //
      if ( this.tree.checkboxStyle !== "none" ) {
        this._createCheckBox( this.tree.checkboxMultiState );
      }
      if (this.tree._icon) {
        this.set( "icon", this.tree._icon );
      }
      // Just in case one is available, set the tooltip.
      this.set("tooltip", this.title );
      this.inherited( arguments );
    }
  });  /* end declare() _TreeNode*/


  return declare( [Tree], {
    // checkboxStyle: String
    //    Sets the style of the checkbox to be used. Currently only "none" has
    //    any impact. 
    checkboxStyle: null,

    // checkboxMultiState: Boolean
    //    Determines if Multi State checkbox behaviour is required, default is true.
    //    If set to false the value attribute of a checkbox will only be 'checked'
    //    or 'unchecked'. If true the state can be 'mixed', true or false.
    checkboxMultiState: true,

    // _icon: String|Object
    //    If _icon is specified the default dijit icons 'Open' 'Closed' and 'Leaf'
    //    will be replaced with a custom icon sprite with three distinct css classes:
    //    'Expanded', 'Collapsed' and 'Terminal'.
    _icon: null,
    
    // branchIcons: Boolean
    //    Determines if the FolderOpen/FolderClosed icon or their custom equivalent
    //    is displayed.
    branchIcons: true,

    // branchReadOnly: Boolean
    //    Determines if branch checkboxes are read only. If true, the user must
    //    check/uncheck every child checkbox individually. 
    branchReadOnly: false,
    
    // nodeIcons: Boolean
    //    Determines if the Leaf icon, or its custom equivalent, is displayed.
    nodeIcons: true,

    // storeEvents: [private] array of strings
    //    List of additional events (attribute names) the onItemChange() method
    //    will act upon besides the _checkedAttr property value.
    _storeEvents: [ "label", "icon" ],

    // _checkedAttr: [private] String
    //    Attribute name associated with the checkbox checked state in the store.
    //    The value is retrieved from the models 'checkedAttr' property and added
    //    to the list of store events.
    _checkedAttr: "",
    
    // _customWidget: [private]
    // 
    _customWidget: null,
    
    _createTreeNode: function ( args ) {
      // summary:
      //    Create a new cbtreeTreeNode instance.
      // description:
      //    Create a new cbtreeTreeNode instance.
      // tags:
      //    private
      args["widget"] = this._customWidget;
      return new TreeNode( args );
    },

    _icon2Object: function( /*String|Object*/ icon ) {
      // summary:
      //    Convert a string argument into an icon object. If icon is already an
      //    object it is tested for the minimal required properties.
      // icon:
      //    A string specifying the css class of the icon or an object with two
      //    properties: {cssClass: /*string*/, indent: /*boolean*/ }
      // tags:
      //    private
      if ( typeof icon != "object" ) {
        if ( (typeof icon == "string") && icon.length ) {
          return { cssClass: icon, indent: true };
        } else {
          throw new Error(this.declaredClass+"::_icon2Object(): icon must be an object or string");
        }
      } else {
        if (icon.cssClass && icon.cssClass.length) {
          return icon;
        }
        throw new Error(this.declaredClass+"::_icon2Object(): required property 'cssClass' is missing or empty");
      }
    },
    
    _onCheckBoxClick: function (/*TreeNode*/ nodeWidget, /*Boolean|String*/ newState, /*Event*/ evt) {
      // summary:
      //    Translates checkbox click events into commands for the controller
      //    to process.
      // description:
      //    the _onCheckBoxClick function is called whenever a mouse 'click'
      //    on a checkbox is detected. Because the click was on the checkbox
      //    we are not dealing with any node expansion or collapsing here.
      // tags:
      //    private

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
      //    label or checkbox state but first check if we are actually interested 
      //    in the type of attribute that triggered the event as it may not impact
      //    the tree at all.
      //
      //  IMPORTANT:
      //    In case of a checkbox update event we call the set() method of the
      //    checkbox direct as node.set("checked",value) would go back to the
      //    model again.
      // tags:
      //    private
        
      if ( array.indexOf( this._storeEvents, attr ) != -1 ) {
        var identity = this.model.getIdentity(storeItem),
            nodes = this._itemNodesMap[identity],
            request = {};

        if (nodes){
          request[attr] = value;
          array.forEach(nodes, function(node){
            if ( attr == this._checkedAttr ) {
              node._checkBox.set( "checked", value );
            } else {
              node.set( request );
            }
          }, this );
        }
      }
    },

    _onKeyPress: function (/*Event*/ evt){
      // summary:
      //    Toggle the checkbox state when the user pressed the spacebar.
      // description:
      //    Toggle the checkbox state when the user pressed the spacebar.
      //    The spacebar is only processed if the widget that has focus is
      //    a tree node and has a checkbox.
      // tags:
      //    private

      if ( !evt.altKey ) {
        var treeNode = registry.getEnclosingWidget(evt.target);
        if ( (typeof evt.charOrCode == "string") && (evt.charOrCode == " ") ) {
          treeNode._toggleCheckBox();
        }
      }
      this.inherited(arguments);  /* Pass it on to the parent tree... */
    },

    _setIconAttr: function (/*string|object*/ icon ) {
      // summary:
      //    Hook for the set("icon",customIcon) method and allows for dynamic
      //    changing of the tree node icons. If icon if a valid argument all
      //    icon related information for every tree node is updated.
      //
      //    NOTE: No matter what the custom icon is, the associated css file(s)
      //          MUST have been loaded prior to setting the new icon.
      // icon:
      //    A string specifying the css class of the icon or an object with two
      //    properties: {cssClass: /*string*/, indent: /*boolean*/ }
      // tags:
      //    private
      
      this._icon = this._icon2Object( icon );
      // During tree instantiation there is no root node.
      if (this._icon && this.rootNode) {
        this.rootNode._setNodeIconAll( this._icon );
      }
    },

    _setWidgetAttr: function(/*function|object*/ widget ) {
      // summary:
      //    Set the custom widget. This method is the hook for set("widget",widget).
      // description:
      //    Set the custom widget. A valid widget MUST have a 'checked' property
      //    AND methods get() and set() otherwise the widget is rejected and an
      //    error is thrown.
      // widget: 
      //    An object or function. In case of an object, the object can have the
      //    following properties:
      //      widget:   Function, the widget constructor.
      //      attr:     Object, arguments passed to the constructor (optional)
      //      target:   String, target nodename (optional)
      // tag:
      //    experimental
      var customWidget = widget,
          property = "checked",
          message,
          proto;

      if (typeof widget != "object") {
        return this._setWidgetAttr( { widget: widget } );
      }

      if( widget.hasOwnProperty( "widget" ) ) {
        customWidget = widget.widget;
        if( typeof customWidget == "function" ){
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
    
    getIconClass: function (/*dojo.data.Item*/ storeItem, /*Boolean*/ opened ){
      // summary:
      //    Return the css class(es) for the node Icon. This local implementation
      //    accepts the addition argument 'nodeWidget'.
      // description:
      //    Return the css class(es) for the node Icon. If custom icons are enabled,
      //    the base class returned is either: 'Expanded', 'Collapsed' or 'Terminal'
      //    prefixed with the custom icon class. If custom icon indentation is true
      //    an additional class is returned which is the base class suffixed with 
      //    the current indent level. If custom icons are disabled the default dijit
      //    css class is returned. 

      if (!this._icon) {
        return this.inherited(arguments);
      }
      
      var isExpandable = this.model.mayHaveChildren(storeItem),
          iconClass  = this._icon.cssClass;

      iconClass += ((!storeItem || isExpandable ) ? (opened ? "Expanded" : "Collapsed") : "Terminal");
      return iconClass;
    },

    getIconStyle:function (/*dojo.data.Item*/ storeItem, /*Boolean*/ opened, /*TreeNode?*/ nodeWidget ) {
      // summary:
      //    Return the DOM style for the node Icon. This local implementation
      //    accepts the addition argument 'nodeWidget'.
      // description:
      //    Return the DOM style for the node Icon. If a style object for the
      //    custom icons was specified is it returned.

      var style = {};
      
      if ( nodeWidget ) {
        if ( nodeWidget.isExpandable ) {
          if ( !this.branchIcons ) {
            style["display"] = "none";
            return style;
          }
        } else {
          if ( !this.nodeIcons ) {
            style["display"] = "none";
            return style;
          }
        }
      }
      return style;
    },

    onCheckBoxClick: function (/*dojo.data.Item*/ storeItem, /*treeNode*/ treeNode, /*Event*/ e) {
      // summary:
      //    Callback when a checkbox on a tree node is clicked.
      // tags:
      //    callback
    },
    
    postCreate: function () {
      // summary:
      //    Handle any specifics related to the tree and model after the
      //    instanciation of the Tree. 
      // description:
      //    Whenever checkboxes are requested Validate if we have a 'write'
      //    store first and kickoff the initial checkbox data validation.

      var store = this.model.store;

      if ( this.checkboxStyle !== "none" ) {
        if (!store.getFeatures()['dojo.data.api.Write']){
          throw new Error(this.declaredClass+"::postCreate(): store must support dojo.data.Write");
        }
        // Get the checked state attribute name and add it to the list of store
        // events.
        this._checkedAttr = this.model.get("checkedAttr");
        this._storeEvents.unshift( this._checkedAttr );
        
        this.model.multiState = this.checkboxMultiState;
        this.model._validateData();
      }
      this.inherited(arguments);
    },
    
    setIcon: function( /*String|Object*/ icon, /*dojo.data.item?*/ storeItem ) {
      // summary:
      //    Set a custom icon. If the storeItem argument is ommitted the icon is
      //    applied to all tree nodes otherwise to the specified store item only.
      // icon:
      //    A string specifying the css class of the icon or an object with two
      //    properties: {cssClass: /*string*/, indent: /*boolean*/ }
      // storeItem:
      //    A valid store item whose icon to set.
      
      var newIcon = this._icon2Object(icon);
      if (storeItem){
        if (this.model.isItem(storeItem)) {
          this._onItemChange( storeItem, "icon", newIcon );
        } else {
          throw new Error(this.declaredClass+"::setIcon(): invalid store item specified.");
        }
      } else {
        this.set( "icon", newIcon );
      }
    }
  });  /* end declare() Tree */

});  /* end define() */
