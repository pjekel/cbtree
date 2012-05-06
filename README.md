# The Dijit CheckBox Tree #

The CheckBox Tree, github project code 'cbtree' was formerly published under
the name [Dijit Tree with Multi State Checkboxes](http://thejekels.com). 
Both the Tree and associated models are highly configurable providing support
for:

* The standard dijit tree, that is, without checkboxes.
* Default dual state checkboxes (checked/unchecked).
* Multi state checkboxes (checked/unchecked/mixed).
* Alternative widgets instead of the standard checkbox widget.
* Optional strict Parent-Child checkbox relationship.
* Tree Styling and Custom Icons API
* Hide branch and/or leaf icons
* Enhanced Store Model API

All dijit CheckBox Tree modules are fully AMD compliant, the CheckBox Tree
comes with two powerful extensions (API's) allowing the user to programmatically
control every aspect of the tree. Both extensions are optional therefore
if the user does not require the functionality they do not need to be loaded.

1. Tree Styling API
2. Store Model API

#### Important: ####
The new CheckBox Tree implementation is a complete rewrite of the previous
*Dijit Tree with Multi State Checkboxes*, adding new properties, features and
API's. If you plan on migrating from the old tree to this new implementation
it is important you read all the documentation provided as properties have been
renamed and some properties have moved from the tree to the model and vice versa.

<h2 id="basics">CheckBox Tree Documentaion</h2>
The full documentation set can be found in the /documentation directory. [test](documentation/CheckBoxTree.md)