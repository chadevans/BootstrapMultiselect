# ReferenceSetDropdown

Based on the Bootstrap Multiselect project [https://github.com/davidstutz/bootstrap-multiselect](https://github.com/davidstutz/bootstrap-multiselect), enables a simple display for a many-to-many relationship in Mendix.

## Contributing

For more information on contributing to this repository visit [Contributing to a GitHub repository](https://world.mendix.com/display/howto50/Contributing+to+a+GitHub+repository)!

## Typical usage scenario

When you want to allow an entity to have many related entities, and don't want to use the built it Reference Set widget. The use case that this was designed around was doing a custom filtering of a data grid, where you want to allow the users to filter by a product category and allow for multiple categories to be selected.
 
## Configuration

Once the widget is installed in your project, there are three things that must be set.

1. Reference: This is the many-to-many reference of the enclosing entity.
2. Display Attribute: This is the attribute used to generate the capation of each item in the list.
3. Sort Attribute: This is the attribute used to sort the data before building the list.

You can then figure out how you want the control to behave, like allowing filtering of the list, or allowing a select all option.