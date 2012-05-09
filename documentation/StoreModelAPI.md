# Store Model API #
The Store Model API extends the functionality of the standard CheckBox Tree Store
Models. The API allows the user to programmatically build and maintain checkbox
trees. For example, you can create your store starting with an empty JSON dataset
or use an existing data store and use the Store Model API to add, move, remove or
change store items.

The Store Model API can be loaded and used with both the TreeStoreModel as well as
the ForestStoreModel.

### Loading the API ###
The Store Model API is implemented as an extension to the [Store Models](StoreModels.md)
and as such needs to be loaded as a separate module. The following sample demonstrates how
to load the Store Model API 

    require([ 
        "dojo/data/ItemFileWriteStore",
        "cbtree/Tree",                      // Checkbox Tree
        "cbtree/models/ForestStoreModel",   // Forest Store Model
        "cbtree/models/StoreModel-API"      // Store Model API extensions
      ], function( ItemFileWriteStore, Tree, ForestStoreModel, StoreModelAPI ) {

            ...

         }
    );

You can test the availability of the Store Model API using the command `has("cbtree-storeModel-API")`
. For example:

    require(["dojo/has",
                ...
            ], 
      function( has, ... ) {
        if (has("cbtree-storeModel-API")) {
                ...
        }
      }
      

<h2 id="store-model-api-functions">Store Model API Functions</h2>

#### addReference( childItem, parentItem, childrenAttr ) ####
> Add an existing store item (childItem) to the parentItem by reference.

*childItem:* data.item
> A valid dojo.data.store item.

*parentItem:* data.item
> A valid dojo.data.store item.

*childrenAttr:* String (optional)
> Property name of the parentItem identifying the children's list to which the
> reference is added. If omitted, the first entry in the models *childrenAttrs*
> property is used.

***********************************
#### attachToRoot( storeItem ) ####
> Promote a store item to a top-level store item.

*storeItem:* data.item
> A valid dojo.data.store item.

******************************************
#### check( query, onComplete, scope) ####
> Check all store items that match the query.

*query:* Object | String
> A JavaScript object as a set of JavaScript 'property name: value' pairs. If
> the *query* argument is a string, the value is used to match store items
> identifier.

*onComplete:* Function (optional)
> If an onComplete callback is specified, the callback function will be called
> just once, after the last storeItem has been updated as: *onComplete(matches, updates)*
> were *matches* equates to the total number of store items that matched the
> query and *updates* equates to the number of store items that required an
> update.

*scope:* Object (optional)
> If a scope object is provided, the function onComplete will be invoked in the
> context of the scope object. In the body of the callback function, the value
> of the "this" keyword will be the scope object. If no scope is provided, 
> onComplete will be called in the context of the model.

******************************************
#### deleteItem( storeItem ) ####
> Delete a store item.

*storeItem:* data.item
> A valid dojo.data.store item.

******************************************
#### detachFromRoot( storeItem ) ####
> Detach item from the store root by removing it from the stores top-level item
> list. Note: the store item is not deleted.

*storeItem:* data.item
> A valid dojo.data.store item.

******************************************
#### fetchItem( query, identAttr ) ####
> Get the store item that matches *query*. Parameter *query* is either an object or a string.

*query:* Object | String
> A JavaScript object as a set of JavaScript 'property name: value' pairs. If
> the *query* argument is a string, the value is used to match store items
> identifier.

*identAttr:* String (optional)
> Attribute/property name. If specified AND parameter *query* is an object,
> the property in *query* to be used as the identifier otherwise the default
> store identifier is used.

******************************************
#### fetchItemsWithChecked( query, onComplete, scope ) ####
> Get the list of store items that match the query and have a checked state,
> that is, a property identified by the models *checkedAttr* property. 
> (See [Model Properties](StoreModels.md#store-model-properties))

*query:* Object | String
> A JavaScript object as a set of JavaScript 'property name: value' pairs. If
> the *query* argument is a string, the value is used to match store items
> identifier.

*onComplete:* Function (optional)
> If an onComplete callback is specified, the callback function will be called
> just once, after the last storeItem has been updated as: *onComplete(matches, updates)*.

*scope:* Object (optional)
> If a scope object is provided, the function onComplete will be invoked in the
> context of the scope object. In the body of the callback function, the value
> of the "this" keyword will be the scope object. If no scope is provided, 
> onComplete will be called in the context of the model.

******************************************
#### get( attribute ) ####
> Accessor, provide the getter capabilities for the model properties.

*attribute:* String
> The name of a model attribute/property whose value is to be returned.

******************************************
#### getItemAttr( storeItem , attribute ) ####
> Provide the getter capabilities for store items thru the model. The getItemAttr()
> method strictly operates on store items not the model itself. Equivalent to *store.getValue()*

*storeItem:* data.item
> A valid dojo.data.store item.

*attribute:* String
> The name of a store item attribute/property whose value is to be returned.

******************************************
#### isRootItem( something ) ####
> Returns true if *something* is a top-level item in the store otherwise false.
> Please refer to section: [Store Root versus Tree Root](StoreModels.md#store-root-versus-tree-root)
> for additional information.

******************************************
#### newReferenceItem( args, parentItem, insertIndex, childrenAttr ) ####
> Create a new top-level item and add it as a child to the parentItem by reference.

*args:*
> A JavaScript object defining the initial content of the item as a set of
> JavaScript 'property name: value' pairs.

*parentItem:* data.item
> A valid dojo.data.store item.

*insertIndex:* Number (optional)
> Zero based index, if specified the location in the parents list of child items.

*childrenAttr:* String (optional)
> Property name of the parentItem identifying the children's list to which the
> new item is added. If omitted, the first entry in the models *childrenAttrs*
> property is used.

******************************************
#### removeReference( childItem, parentItem, childrenAttr ) ####
> Remove a child reference from its parent. Only the reference is removed,
> the childItem is not delete.

*childItem:* data.item
> A valid dojo.data.store item.

*parentItem:* data.item
> A valid dojo.data.store item.

*childrenAttr:* String (optional)
> Property name of the parentItem identifying the children's list from which the
> reference is removed. If omitted, the first entry in the models *childrenAttrs*
> property is used.

******************************************
#### set( attribute, value ) ####
> Accessor, provide the setter capabilities for the model properties.

*attribute:* String
> The name of a model attribute/property whose value is to be updated.

*value:* AnyType
> New value to be assigned to the property *attribute*

******************************************
#### setItemAttr( storeItem, attribute, value ) ####
> Provide the setter capabilities for store items thru the model. The setItemAttr()
> method strictly operates on store items not the model itself. Equivalent to *store.setValue()*

*storeItem:* data.item
> A valid dojo.data.store item.

*attribute:* String
> The name of a store item attribute/property whose value is to be updated.

*value:* AnyType
> New value to be assigned to the property *attribute*

******************************************
#### uncheck( query, onComplete, scope ) ####
> Uncheck all store items that match the query.

*query:* Object | String
> A JavaScript object as a set of JavaScript 'property name: value' pairs. If
> the *query* argument is a string, the value is used to match store items
> identifier.

*onComplete:* Function (optional)
> If an onComplete callback is specified, the callback function will be called
> just once, after the last storeItem has been updated as: *onComplete(matches, updates)*
> were *matches* equates to the total number of store items that matched the
> query and *updates* equates to the number of store items that required an
> update.

*scope:* Object (optional)
> If a scope object is provided, the function onComplete will be invoked in the
> context of the scope object. In the body of the callback function, the value
> of the "this" keyword will be the scope object. If no scope is provided, 
> onComplete will be called in the context of the model.


<h2 id="sample-application">Sample Application</h2>
****************************************
The following sample application demonstrate the use of several of the Store Model
API functions. A more elaborate demo can be found at /cbtree/demos/tree03.html

    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
      <head> 
        <title>CheckBox Tree using the Model API</title>     

        <style type="text/css">
          @import "../../dijit/themes/claro/claro.css";
          @import "../themes/claro/claro.css";
        </style>

        <script type="text/JavaScript">
          var dojoConfig = {
                async: true,
                parseOnLoad: true,
                isDebug: true,
                baseUrl: "../../",
                packages: [
                  { name: "dojo",  location: "dojo" },
                  { name: "dijit", location: "dijit" },
                  { name: "cbtree",location: "cbtree" }
                ]
          };
        </script>
        <script type="text/JavaScript" src="../../dojo/dojo.js"></script> 
      </head>
        
      <body class="claro">
        <div id="CheckboxTree">
          <script type="text/JavaScript">
            require([ "dojo/_base/array",
                      "dojo/domReady",
                      "dojo/data/ItemFileWriteStore",
                      "cbtree/Tree",                      // Checkbox Tree
                      "cbtree/models/ForestStoreModel",   // Forest Store Model
                      "cbtree/models/StoreModel-API"      // Store Model API extensions
                    ], function( array, domReady, ItemFileWriteStore, Tree, ForestStoreModel ) {

              // Declare an empty JSON data object (an empty store).
              var EmptyData = { identifier: 'name', label:'name', items:[] };
                
              // Create the Forest Store model
              model = new ForestStoreModel( {
                      store: new ItemFileWriteStore( { data: EmptyData }),
                      query: {type: 'parent'},
                      rootLabel: 'The Simpsons Tree',
                      checkedAll: true,
                      checkedRoot: true
                      }); 
              // Create the tree (which will be empty). 
              tree = new Tree( { model: model, id: "MyTree", autoExpand: true });

              // Add all items as top-level store entries.
              model.newItem( { name: 'Homer', type: 'parent', hair: 'none' } );
              model.newItem( { name: 'Marge', type: 'parent', hair: 'blue' } );

              model.newItem( { name: 'Bart',  type: 'child', hair:'black' } );
              model.newItem( { name: 'Lisa',  type: 'child', hair:'blond' } );
              model.newItem( { name: 'Maggie',type: 'child', hair:'brown' });

              // Add a reference to parent 'Homer' for each child with a 'checked' state
              model.fetchItemsWithChecked( { type:'child' }, function(children) {
                  var parent = this.fetchItem('Homer');
                  array.forEach( children, function(child){
                    this.addReference( child, parent );
                  }, this )
                }, model );

              // Set checked state of all store items to 'checked' and then uncheck 'Bart'.
              model.check( '*' );
              model.uncheck( 'Bart' );

              // Chnage store item attribute...
              model.setItemAttr( model.fetchItem('Bart'), 'hair', blond' );
              
              domReady( function() {
                tree.placeAt( "CheckboxTree" );
              });
            });
          </script>
        </div>
      </body>
    </html>


