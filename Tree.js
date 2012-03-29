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
    // checkBox: 
    //    Reference to a checkbox widget.
    checkBox: null,

    // templateString: String
    //    Specifies the HTML template to be used.
    templateString: NodeTemplate,

    _applyClassAndStyle: function (/*dojo.data.Item*/ storeItem, /*String*/ lower, /*String*/ upper){
      // summary:
      //    Set the appropriate CSS classes and styles for labels, icons and rows.
      //    This local implementation passes the nodeWidget ("this") as an extra 
      //    argument to support custom icons.
      // storeItem:
      //    The data storeItem.
      // lower:
      //    The lower case attribute to use, e.g. 'icon', 'label' or 'row'.
      // upper:
      //    The upper case attribute to use, e.g. 'Icon', 'Label' or 'Row'.
      // tags:
      //    private

      var clsName  = "_" + lower + "Class";
      var nodeName = lower + "Node";
      var oldCls   = this[clsName];

      this[clsName] = this.tree["get" + upper + "Class"](storeItem, this.isExpanded, this);
      domClass.replace(this[nodeName], this[clsName] || "", oldCls || "");
      domStyle.set(this[nodeName], this.tree["get" + upper + "Style"](storeItem, this.isExpanded, this) || {});
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
      // Allow the ability to pass in another checkbox or multi state widget. (later).
      if ( this.checkBox == null ) {
        if ( checked !== undefined ) {
          this.checkBox = new CheckBox( { multiState: multiState,
                                           checked: checked,
                                           value: this.label }
                                        );
          domConstruct.place(this.checkBox.domNode, this.checkBoxNode, 'replace');
        }
      } 
      else /* Passed in checkbox... */
      {
        this.checkBox.set("checked", checked );
      }
      if ( this.checkBox ) {
        if ( this.isExpandable && this.tree.branchReadOnly ) {
          this.checkBox.set( "readOnly", true );
        }
      }
    },

    _getCheckedAttr: function() {
      // summary:
      //    Get the current checkbox state. This method implements get("checked").
      // tags:
      //    private
      
      if ( this.checkBox ) {
        return this.tree.model.getItem( this.item, "checked");
      }
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

      if (evt.target.nodeName == 'INPUT') {
        var newState = this.checkBox.get("checked");
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

      if ( this.checkBox ) {
        return this.tree.model.setItem( this.item, "checked", newState );
      }
    },
    
    _toggleCheckBox: function (){
      // summary:
      //    Toggle the current checkbox checked attribute and update the store
      //    accordingly. Typically called when the spacebar is pressed.
      // tags:
      //    private

      var newState;
      if ( this.checkBox ) {
        newState = this.checkBox.toggle();
        this.tree.model.setItem( this.item, "checked", newState );
      }
      return newState;
    },
    
    _updateIcon: function() {
      // summary:
      //    Update the icon class for all tree nodes. This method is only called
      //    when custom icons are applied dynamically using set("customIcons",...)
      //    on the tree.
      // tags:
      //    private
      this._applyClassAndStyle( this.item, "icon", "Icon" );
      array.forEach( this.getChildren(), function(child) {
            child._updateIcon();
          });     
    },
    
    destroy: function () {
      // summary:
      //    Destroy the checkbox of the tree node widget.
      //
      if ( this.checkbox ) {
        this.checkbox.destroy();
      }
      this.inherited(arguments);
    },

    postCreate: function () {
      // summary:
      //    Handle the creation of the checkbox after the tree node has been
      //    instanciated.
      // description:
      //    Handle the creation of the checkbox after the tree node has been
      //    instanciated.  If customIcons are specified for the tree, set it
      //    here and remove the default 'dijit' classes. (see template).
      //
      var domNode;

      if ( this.tree.checkboxStyle !== "none" ) {
        this._createCheckBox( this.tree.checkboxMultiState );
      }
      if ( this.tree.customIcons )
      {
        // We should have a DOM node otherwise something went terribly wrong...
        domNode = dom.byId( this.iconNode );
        if( domNode ) {
          // Remove all existing css classes and replace it with the custom icon
          // base class and apply the node specific classes.
          domClass.replace( this.iconNode, this.tree.customIcons.cssClass, (domNode["className"] || "") );
          this._applyClassAndStyle( this.item, "icon", "Icon" );
        }
      }
      // Just in case one is available, set the tooltip.
      this.set("tooltip", this.title );
      this.inherited( arguments );
    }
  });  /* end declare() TreeNode*/


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

    // customIcons: String|Object
    //    If customIcons is specified the default dijit icons 'Open' 'Closed' and
    //    'Leaf' will be replaced with a custom icon sprite with three distinct css
    //    classes: 'Expanded', 'Collapsed' and 'Terminal'.
    customIcons: null,
    
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
    _storeEvents: [ "label" ],

    // _checkedAttr: [private] String
    //    Attribute name associated with the checkbox checked state in the store.
    //    The value is retrieved from the models 'checkedAttr' property and
    //    added to the list of store events.
    _checkedAttr: "",
    
    _createTreeNode: function ( args ) {
      // summary:
      //    Create a new cbtreeTreeNode instance.
      // description:
      //    Create a new cbtreeTreeNode instance.
      // tags:
      //    private
      return new TreeNode( args );
    },

    _setCustomIconsAttr: function (/*string|object*/ customIcons ) {
      // summary:
      //    Hook for the set("customIcon",customIcon) method and allows for dynamic
      //    changing of the tree node icons. If customIcons if a valid argument all
      //    icon related information for every tree node is updated.
      //
      //    NOTE: No matter what the custom icons are, the associated css file(s)
      //          MUST have been loaded prior to setting the new icon.
      // customIcons:
      //    A string specifying the css class of the custom icons or an object with
      //    two properties: {cssClass: /*string*/, indent: /*boolean*/ }
      // tags:
      //    private
      
      if ( typeof customIcons != "object" ) {
        if ( (typeof customIcons == "string") && customIcons.length ) {
          this.customIcons = { cssClass: customIcons, indent: true };
        } else {
          throw new Error("cbtree: customIcons must be an object or string");
        }
      } else {
        this.customIcons = customIcons;
      }
      // During tree instantiation there is no root node.
      if (this.customIcons && this.rootNode) {
        this.rootNode._updateIcon();
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
      //    model creating an infinite loop.
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
              node.checkBox.set( "checked", value );
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

    getIconClass: function (/*dojo.data.Item*/ storeItem, /*Boolean*/ opened, /*TreeNode?*/ nodeWidget ){
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

      if ( !this.customIcons ) {
        return this.inherited(arguments);
      }
      
      var isExpandable = nodeWidget ? nodeWidget.isExpandable : this.model.mayHaveChildren(storeItem),
          customIndent = this.customIcons.indent,
          customClass  = this.customIcons.cssClass,
          iconClass;

      iconClass = customClass + ((!storeItem || isExpandable ) ? (opened ? "Expanded" : "Collapsed") : "Terminal");
      if ( nodeWidget ) {
        if ( customIndent !== undefined && customIndent !== false ) {
          // Test boolean versus numeric
          if ( customIndent === true || customIndent >= nodeWidget.indent ) {
            return ( customClass + ' ' + iconClass + ' ' + iconClass + '_' + nodeWidget.indent );
          }
        }
      }
      return (customClass + ' ' + iconClass);
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
      if ( this.customIcons && this.customIcons.style ) {
        if ( typeof this.customIcons.style == "object" ) {
          return this.customIcons.style;
        }
      }
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
          throw new Error("postCreate(): store must support dojo.data.Write");
        }
        // Get the checked state attribute name and add it to the list of store
        // events.
        this._checkedAttr = this.model.get("checkedAttr");
        this._storeEvents.unshift( this._checkedAttr );
        
        this.model.multiState = this.checkboxMultiState;
        this.model._validateData();
      }
      this.inherited(arguments);
    }
  });  /* end declare() Tree */

});  /* end define() */
