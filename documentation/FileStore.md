# The File Store #

The cbtree FileStore implements an in memory store whose content represent the file 
system layout of the HTTP back-end server document root directory or portions thereof.
The store is dynamically loaded by issueing HTTP GET requests to the back-end server
serving the active HTML page. Each server responses is loaded into the in-memory store.

Please notice that only HTTP GET requests are used therefore changing the file system
on the back-end server or its content is not supported by the cbtree FileStore and
server side applications. 

#### Lazy Store Loading ####

The cbtree File Store fully supports the concept of *Lazy Loading* which is the process 
of loading back-end information ondemand, or in other words: only load what and when needed.
Depending on the store model used with the File Store the user can influence this behavior.
For example, if the File Store is used with the cbtree FileStoreModel, the 
[model properties](StoreModels.md#store-model-properties) *deferItemLoadingUntilExpand*
and *checkedStrict* actually determine how data is retreived from the back-end server.

If you elect to use a store model that requires a full store load (no lazy loading), such
as the FileStoreModel with the model property *checkedStrict* set, please check the '*Which
Application to use*' section of the [Server Side Applications](#file-store-ssapp) as 
performance may be an issue.


<h2 id="file-store-requirements">File Store Requirements</h2>

In order for the cbtree File Store to function properly your back-end server 
must host at least one of the server side applications included in the cbtree package:

* cbtreeFileStore.php
* cbtreeFileStore.cgi

See the [Server Side Application](#file-store-ssapp) section for details on how to 
select the correct application for your environment and possible additional requirements.

#### File Store Restrictions ####

The File Store uses the JavaScript XHR API to communicate with the back-end server,
as a result cross-domain access is, by default, denied. If you need to retreive file
system information from any server other than the one whos hosting the active HTML
page you must configure a so-called HTTP proxy server. (**The configration of a HTTP 
proxy server is beyond the scope of this document**).

<h2 id="file-store-ssapp">Server Side Applications</h2>

The cbtree File Store comes with two implementations of the cbtree server side application,
one written in PHP the other is an ANSI-C CGI application compliant with the 
[CGI Version 1.1](http://datatracker.ietf.org/doc/rfc3875/) specification. Your HTTP 
server must host at least one of them. 

#### Which Application to use ####

Both applications offer the same functionality but they operates in a different HTTP 
back-end server environment each with its own requirements.  
The primary selection criteria are:

1. What application environment does your server support? PHP, CGI or both.
2. Is a complete store load required by you application?
3. The size of the file system 

If your server only support PHP or CGI but not both the choice is simple. If, on the other hand, 
both are supported and your application requires a full store load, that is, load all available
information up-front like with the FileStoreModel that has strict parent-child relationship enabled, 
than the last question will determine the final outcome. If you operate on a large file system with
5000+ files it is highly recommended you use the ANSI-C CGI implementation.

Please keep in mind that most scripting languages such as PHP are implemented as an interpreter
and therefore slower than any native compiled code like the ANSI-C CGI application. 

As an example, running both the browser application and the PHP server side aplication on the
same 4 core 2.4 Mhz AMD processor with a file system of 21,000 files takes about 12 seconds to
completely render the tree. Running the exact same browser application but with the CGI 
application takes only 3-4 seconds.

If your application does not require a full store load and none of the directories served by the
server side application has thousands of file entries you probably won't notice much of a difference
as only a relatively small amounts of processing power is required for each request by the server.

#### cbtreeFileStore.php ####

If you are going to use the PHP implementation, your HTTP server must provide PHP support and have the
PHP JSON feature set enabled. The actual location of the server application on your back-end
server is irrelevant as long as it can be access using a formal URL. See the uasge of the 
store property *baseURL* for more details.

#### cbtreeFileStore.cgi ####

The ANSI-C CGI application needs to be compiled for the target Operating System. 
Currently a Microsoft Windows implementation and associated Visual Studio 2008 project
is included in the cbtree package.
If you need the CGI application for another OS please refer to the inline documentation
of the *cbtree_NP.c* module for details. Module 'cbtree_NP.c' is the only source module
that contains Operating System specific code.

The location to install the CGI application depends on the HTTP server configuration. On an
Apache HTTP server the application is typically installed in the /cgi-bin directory. 
For Apache users, please checkout the [CGI configuration](http://httpd.apache.org/docs/2.2/howto/cgi.html)
instructions for details.

##### External Dependency #####

The ANSI-C CGI implementation requires the 'Perl Compatible Regular Expressions' library to be 
available on your system for linking. The cbtree/stores/server/CGI/PCRE directory contains
a PCRE 8.10 windows version of the library. You can get the latest version of the PCRE
source code [here](http://pcre.org/)

***NOTE:*** 
> Please make sure the PCRE sharable image (pcre.dll on Windows) is included in your system
> path ***AND*** has been given the proper access privileges. The easies way of installing 
> PCRE on your server is to include it in your installation directory, this will also avoid
> any incompatability issues in case your system path already includes an instance of PCRE.

#### Write your own application ####

If, for whatever reason, you have to or want to write your own server side application use 
the source code of the PHP and ANSI-C implementation as your guideline in terms of functionality.
Below you'll find the ABNF notation for the server request and response.

##### Request: #####

	HTTP-GET 	  ::= uri ('?' query-string)?
	query-string  ::= (qs-param ('&' qs-param)*)?
	qs-param	  ::= basePath | path | query | queryOptions | options | 
					  start | count | sort
	basePath	  ::= 'basePath' '=' path-rfc3986
	path		  ::= 'path' '=' path-rfc3986
	query		  ::= 'query' '=' json-object
	query-options ::= 'queryOptions' '=' json-object
	options		  ::= 'options' '=' json-array
	start		  ::= 'start' '=' number
	count		  ::= 'count' '=' number
	sort 		  ::= 'sort' '=' json-array

##### Response: #####

	response	  ::= '[' (totals ',')? (status ',')? file-list ']'
	totals 		  ::= '"total"' ':' number
	status		  ::= '"status"' ':' status-code
	status-code	  ::=	'200' | '204'
	file-list	  ::= '"items"' ':' '[' file-info* ']'
	file-info	  ::= '{' name ',' path ',' size ',' modified ',' directory 
					    (',' children ',' expanded)? '}'
	name		  ::= '"name"' ':' json-string
	path		  ::= '"path"' ':' json-string
	size		  ::= '"size"' ':' number
	modified	  ::= '"modified"' ':' number
	directory	  ::= '"directory"' ':' ('true' | 'false')
	children	  ::= '[' file-info* ']'
	expanded	  ::= '"_EX"' ':' ('true' | 'false')
	number		  ::= DIGIT+
	DIGIT		  ::= '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

Please refer to [http://json.org/](http://json.org/) for the JSON encoding rules.


<h2 id="file-store-properties">File Store Properties</h2>

#### basePath: ####
> String (""), The basePath property is a URI reference (rfc 3986) relative to the
> server's document root and used by the server side application to compose the root 
> directory, as a result the root directory is defined as:
>
> root-dir ::= document-root '/' basepath

#### cache: ####
Boolean (false)

#### childrenAttr: ####
> String ("children"), The attribute name of an item in the server response that
> identifies that item's children. Children in the context of the file store represent
> the content of a directory.

#### clearOnClose: ####
> Boolean (false), ClearOnClose allows the users to specify if a close call should force
> a reload or not. By default, it retains the old behavior of not clearing if close is
> called.  If set true, the store will be reset to default state.  Note that by doing
> this, all item handles will become invalid and a new fetch must be issued.

#### failOk: ####
> Boolean (false), Specifies if it is OK for the xhrGet call to fail silently. If false
> an error is output on the console when the call fails.

#### options: ####
> String[] ([]). A string of comma separated keywords or an array of keywords. The following
> keywords are supported:
> #### dirsOnly ####
> #### iconClass ####
> #### showHiddenFiles ####

#### url: ####
> String (""), The URL of the server side application serving the File Store.

#### urlPreventCache: ####
> Boolean (false), Parameter to allow specifying if preventCache should be passed to
> the xhrGet call or not when loading data from a url. Note this does not mean the 
> store calls the server on each fetch, only that the data load has preventCache set
> as an option.

<h2 id="file-store-fancy">Fancy Tree Styling</h2>


<h2 id="file-store-functions">File Store Functions</h2>

*********************************************
#### close( request ) ####

*********************************************
#### containsValue( item, attribute, value ) ####
> Returns true if the given attribute of item contains value.

*item:* store.item
> A valid file.store item.

*attribute:* String
> The name of an item attribute/property whose value is test.

*********************************************
#### fetch( keywordArgs ) ####

*********************************************
#### fetchItemByIdentity( keywordArgs ) ####

*********************************************
#### getAttributes( item ) ####
> Returns an array of string containing all available attributes. All private store
> attributes are excluded.

*item:* store.item
> A valid file.store item.

*********************************************
#### getIdentity( item ) ####
> Get the identity of an item.

*item:* store.item
> A valid file.store item.

*********************************************
#### getIdentifierAttr() ####
> Get the name of the attribute that holds an items identity.

*********************************************
#### getIdentityAttributes( item ) ####
> Returns an array a attributes names that holds an items identity. In case of the
> File Store it only one attribute. Therefore this function is similar to getIdentifierAttr()
> with the exception that the result is returned as an array.

*item:* store.item
> A valid file.store item.

*********************************************
#### getLabel( item ) ####

*item:* store.item
> A valid file.store item.

*********************************************
#### getLabelAttr() ####
> Return the label attribute of the store. Note: A File Store only has one label attribute.

*********************************************
#### getLabelAttributes( item ) ####
> Return the label attributes of the store as an array of strings. This function is similar
> to getLabelAttr() with the exception that the result is returned as an array.

*item:* store.item
> A valid file.store item.

*********************************************
#### getParents( item ) ####

*item:* store.item
> A valid file.store item.

*********************************************
#### getValue( item, attribute, defaultValue ) ####

*item:* store.item
> A valid file.store item.

*attribute:* String
> The name of an item attribute/property whose value is to be returned.

*********************************************
#### getValues( item, attribute ) ####
> Returns the value of a given attribute of item.

*item:* store.item
> A valid file.store item.

*attribute:* String
> The name of an item attribute/property whose value is to be returned.

*********************************************
#### hasAttribute( item, attribute ) ####

*item:* store.item
> A valid file.store item.

*attribute:* String
> The name of an item attribute/property.

*********************************************
#### isItem( something ) ####

*********************************************
#### isItemLoaded( item ) ####
> Returns true if *item* is loaded into the store otherwise false.

*item:* store.item
> A valid file.store item.

*********************************************
#### isRootItem( item ) ####
> Returns true if *item* is a top-level item in the store otherwise false.

*item:* store.item
> A valid file.store item.

*********************************************
#### loadItem( keywordArgs ) ####

*********************************************
#### loadStore( query, fetchArgs ) ####

*********************************************
#### setValue( item, attribute, newValue ) ####

*item:* store.item
> A valid file.store item.

*attribute:* String
> The name of a item attribute/property whose value is to be set.


<h2 id="file-store-callbacks">File Store Callbacks</h2>

#### onDelete( deletedItem ) ####

*deleteItem:* store.item
> A valid file.store item.

#### onLoaded() ####

#### onNew( newItem, parentInfo) ####

#### onRoot( item, evt ) ####

#### onSet( item, atribute, oldValue, newValue ) ####


<h2 id="file-store-sample">Sample Application</h2>

The following sample application shows the document root directory of the back-end server
as a simple tree with checkboxes. Notice that because the model property *checkedStrict* 
is disabled the FileStoreModel will automatically apply lazy loading.

	<!DOCTYPE html>
	<html>
	  <head> 
		<title>Dijit CheckBox Tree and File Store</title>     
		<style type="text/css">
		  @import "../../dijit/themes/claro/claro.css";
		  @import "../themes/claro/claro.css";
		</style>

		<script type="text/javascript">
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
		<script type="text/javascript" src="../../dojo/dojo.js"></script> 
	  </head>
		
	  <body class="claro">
		<div id="CheckboxTree">  
		  <script type="text/javascript">
			require([
			  "cbtree/Tree",                  // Checkbox tree
			  "cbtree/models/FileStoreModel", // FileStoreModel
			  "cbtree/stores/FileStore"
			  ], function( Tree, FileStoreModel, FileStore) {
				  var store = new FileStore( { url: "../stores/server/php/cbtreeFileStore.php", basePath:"./"} ); 
				  var model = new FileStoreModel( {
						  store: store,
						  rootLabel: 'My HTTP Document Root',
						  checkedRoot: true,
						  checkedStrict: false,
						  sort: [{attribute:"directory", descending:true},{attribute:"name"}]
					   }); 
				  var tree = new Tree( { model: model, id: "MenuTree" });
				  tree.placeAt( "CheckboxTree" );
			});
		  </script>
		</div>
	  </body> 
	</html>


### Fancy Tree Styling ###

The following sample applies *Fancy Icons* to the tree 

	<!DOCTYPE html>
	<html>
	  <head> 
		<title>Dijit CheckBox Tree and File Store</title>     
		<!-- 	
			Load the CSS files including the Apache style icons, alternatively load fileIconsMS.css 
			instead to get Microsoft Windows style icons (but not both).
		-->
		<style type="text/css">
		  @import "../../dijit/themes/claro/claro.css";
		  @import "../themes/claro/claro.css";
		  @import "../icons/fileIconsApache.css";
		</style>

		<script type="text/javascript">
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
		<script type="text/javascript" src="../../dojo/dojo.js"></script> 
	  </head>
		
	  <body class="claro">
		<div id="CheckboxTree">  
		  <script type="text/javascript">

		  require([
			"cbtree/Tree",                  // Checkbox tree
			"cbtree/TreeStyling",           // Checkbox tree Styling
			"cbtree/models/FileStoreModel", // FileStoreModel
			"cbtree/stores/FileStore"
			], function( Tree, TreeStyling, FileStoreModel, FileStore) {

			  // The option 'iconClass' forces the server side application to include the icon classname
			  // in the response.
			  var store = new FileStore( { url: "../stores/server/php/cbtreeFileStore.php", 
										   basePath:"./",
										   options:["iconClass"] } ); 

			  // Tell the model to look for the store item property 'icon' and process it as an icon.
			  var model = new FileStoreModel( {
					  store: store,
					  rootLabel: 'My HTTP Document Root',
					  checkedRoot: true,
					  checkedStrict: false,
										iconAttr: "icon",
					  sort: [{attribute:"directory", descending:true},{attribute:"name"}]
				   }); 

			  // Create the tree and set the icon property so the tree root uses the same set of icons
			  // all tree nodes will use (not required but for consistancy only).
			  var tree = new Tree( { model: model, id: "MenuTree",
									 icon: {iconClass:"fileIcon"}
								   });
			  tree.placeAt( "CheckboxTree" );
			});
		  </script>
		</div>
	  </body> 
	</html>
