//
// Copyright (c) 2010-2012, Peter Jekel
// All rights reserved.
//
//  The Checkbox Tree (cbtree), also known as the 'Dijit Tree with Multi State Checkboxes'
//  is released under to following three licenses:
//
//  1 - BSD 2-Clause                (http://thejekels.com/js/cbtree/LICENSE)
//  2 - The "New" BSD License       (http://bugs.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//  3 - The Academic Free License   (http://bugs.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
//  In case of doubt, the BSD 2-Clause license takes precedence.
//
define([
  "./CheckBox",
  "./Tree",
  "./models/ForestStoreModel",
  "./models/TreeStoreModel",
  "./models/StoreModel-API",
  "./TreeStyling"
  ], function( CheckBox, Tree, ForestStoreModel, TreeStoreModel, StoreModelAPI, TreeStyling ){
	// Define the 'Dijit Tree With CheckBoxes' (cbtree) including the optional
	// Tree store API and Tree Styling extensions.

  var cbtree = { 
        Tree: Tree, 
        ForestStoreModel: ForestStoreModel,
        TreeStoreModel: TreeStoreModel,
        CheckBox: CheckBox 
    };

  return cbtree;
});