//
// Copyright (c) 2012-2013, Peter Jekel
// All rights reserved.
//
//  The Checkbox Tree (cbtree) is released under to following three licenses:
//
//  1 - BSD 2-Clause                (http://thejekels.com/cbtree/LICENSE)
//  2 - The "New" BSD License        (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//  3 - The Academic Free License    (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["module",
        "dojo/_base/declare",
        "dojo/_base/lang",
        "dijit/registry",
        "dijit/tree/dndSource",
        "../Tree",
        "../model/TreeStoreModel",
        "../store/ObjectStore",
        "../store/extensions/Ancestry",
        "../errors/createError!../errors/CBTErrors.json",
        "./QueryEngine",
        "./shim/Array"             // ECMA-262 Array shim
       ], function ( module, declare, lang, registry, dndSource, Tree, TreeStoreModel,
                     ObjectStore, Ancestry, createError, QueryEngine) {

  // module:
  //    cbtree/util/TOC
  // summary:
  //    A simple Table-Of-Content module encapsulating the cbtree, store and
  //    model. This is for demonstration purpose only...

  var CBTError = createError( module.id );    // Create the CBTError type.
  var undef;

  function sameBranch ( target, node ) {
    // summary:
    //    Test if two node are members of the same tree branch.
    function getRootChild(node) {
      var parent = node.getParent();
      if (parent && parent != node.tree.rootNode) {
        return getRootChild(parent);
      }
      return node;
    }

    function isDescendant(root, node)  {
      var children = root.getChildren();
      return children.some( function(child) {
        if (child != node) {
          return isDescendant(child, node);
        }
        return true;
      });
    }
    var rootChild = getRootChild(target);
    return isDescendant(rootChild, node);
  }

  var TOC = declare( null, {

    checked: false,
    name: "Table Of Content",
    
    //=========================================================================
    // Constructor

    constructor: function (/*Object*/ kwArgs, location) {
      // summary:
      // kwArgs:
      
      declare.safeMixin( this, kwArgs );

      var root = { id:"ROOT", name:this.name, type:"ROOT", ref:null };
      this._store = new ObjectStore( {data: [ root ]} );
      this._model = new TreeStoreModel({ store: this._store, 
                                          enabledAttr:"enabled",
                                          query:{type:"ROOT"},
                                          checkedAll: false
                                         });
      this._tree  = new Tree( { model: this._model, 
                                checkItemAcceptance: this._acceptEntry,
                                dndController: dndSource,
                                betweenThreshold: 5,
                                openOnDblClick: this.openOnDblClick || false,
                                openOnClick: this.openOnClick || false,
                                valueToIconMap: this.valueToIconMap || null,
                                persist: false,
                                showRoot:true
                               },
                               location);
    },

    destroy: function () {
      // summary:
      //    Release all memory and mark store as destroyed.
      this._store.destroy();
      this._model.destroy();
      this._tree.destroy();
    },

    //=========================================================================
    // Private methods

    _acceptEntry: function (target, source) {
			// summary:
			//		Test if the source object can be accepted at the target location.
      var targetNode  = registry.getEnclosingWidget(target),
          targetTree  = targetNode.tree,
          targetStore = targetTree.model.store,
          sourceTree  = source.tree;
      var nodeId;
      
      if (sourceTree != targetTree || targetNode == targetTree.rootNode) {
        return false;
      }

      for (nodeId in source.selection) {
        var sourceNode = source.selection[nodeId];
        var sourceId   = targetStore.getIdentity( sourceNode.item );
        
        if (!sameBranch(targetNode, sourceNode)) {
          return false;
        }
      }
      return true;
    },

    _getIdentity: function (something) {
      if ( {}.toString.call(something) == "[object Object]") {
        return this._store.getIdentity(something);
      } else if (typeof something == "string" || typeof something == "number") {
        return something;
      }
    },

    _makeEntry: function( object, options) {
      if (object && object.name) {
        if (object.id && (typeof object.id != "string" && typeof object.id != "number")) {
          throw new CBTError( "InvalidProperty", "_makeEntry", "Property: id"  );
        }
        var checkbox = (options && options.checkbox) || true;
        var readOnly = (options && options.readOnly) || false;
        var parent   = this._store.get(options.parent);
        if (parent) {
          if (checkbox) {
            object.checked = this.checked;
            object.enabled = !readOnly;
          }
          options.parent = parent;  // return parent store object
          return object;
        }
        throw new CBTError( "NotFound", "_makeEntry", "Parent object not found" );
      }
      throw new CBTError( "InvalidProperty", "_makeEntry", "Property: name"  );
    },

    //=========================================================================
    // Public methods

    addHeader: function ( header, options) {
      if (header && header.id) {
        var parentId = this._getIdentity(options && options.parent) || "ROOT";
        options = lang.mixin( options, {parent:parentId});
        header      = this._makeEntry( header, options );
        header.type = "HEADER-" + this._store.getAncestors(options.parent).length;
        // Add header to store and return the object.
        headerId = this._store.add( header, {parent:options.parent} );
        return this.get(headerId);
      }
      throw new CBTError( "PropertyMissing", "addHeader" );
    },

    addEntry: function ( entry, options) {
      if (entry && entry.type) {
        var parentId = this._getIdentity(options && options.parent) || null;
        options = lang.mixin( options, {parent:parentId});
        entry   = this._makeEntry( entry, options );

        var entryId = this._store.add( entry, {parent:options.parent} );
        return this.get(entryId);
      }
    },

    get: function (id) {
      return this._store.get(id);
    },

    getChecked: function (entry) {
      return this._model.getChecked( entry );
    },

    getDescendants: function (item, query) {
      var result = this._store.getDescendants(item);
      if (result && query) {
        result = QueryEngine(query)(result);
      }
      return result;
    },
    
    on: function(/*String*/ type, /*Function*/ func){
      switch(type.toLowerCase()) {
        case "checkboxclick":
        case "click":
        case "dblclick":
          return this._tree.on( type, func );
        case "pasteitem":
          return this._model.on( type, func );
      }
    },

    query: function (query, options) {
      return this._store.query(query, options);
    },

    setChecked: function (entry, state) {
      return this._model.setChecked( entry, !!state );
    },

    startup: function () {
      this._tree.startup();
    },
    
    toString: function () {
      return "[object TOC]";
    }

  });  /* end declare() */

  return TOC;

});
