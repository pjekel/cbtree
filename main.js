//
// Copyright (c) 2010-2012, Peter Jekel
// All rights reserved.
//
//	The Checkbox Tree (cbtree), also known as the 'Dijit Tree with Multi State Checkboxes'
//	is released under to following three licenses:
//
//	1 - BSD 2-Clause								(http://thejekels.com/js/cbtree/LICENSE)
//	2 - The "New" BSD License			 (http://bugs.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	3 - The Academic Free License	 (http://bugs.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
//	In case of doubt, the BSD 2-Clause license takes precedence.
//
define([
	"./CheckBox",
	"./Tree",
	"./models/FileStoreModel",
	"./models/ForestStoreModel",
	"./models/TreeStoreModel",
	"./models/StoreModel-API",
	"./stores/FileStore",
	"./TreeStyling"
	], function( CheckBox, Tree, FileStoreModel, ForestStoreModel, TreeStoreModel, StoreModelAPI, FileStore, TreeStyling ){
			 // Define the 'Dijit CheckBox Tree' (cbtree) including the optional
			 // Tree store API and Tree Styling extensions.
			 var cbtree = { 
						Tree: Tree, 
						FileStoreModel: FileStoreModel,
						ForestStoreModel: ForestStoreModel,
						TreeStoreModel: TreeStoreModel,
						FileStore: FileStore,
						CheckBox: CheckBox 
			 };
			 return cbtree;
		}
);