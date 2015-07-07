/*jslint white:true, nomen: true, plusplus: true */
/*global mx, define, require, browser, devel, console, document, jQuery */
/*mendix */
/*
    BootstrapMultiselect
    ========================

    @file      : BootstrapMultiselect.js
    @version   : 0.1
    @author    : Chad Evans
    @date      : Fri, 26 Jun 2015 19:28:43 GMT
    @copyright : 2015, Mendix B.v.
    @license   : Apache v2

    Documentation
    ========================
    Describe your widget here.
*/

// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
define([
    'dojo/_base/declare', 'mxui/widget/_WidgetBase', 'dijit/_TemplatedMixin',
    'mxui/dom', 'dojo/dom', 'dojo/query', 'dojo/dom-prop', 'dojo/dom-geometry', 'dojo/dom-class', 'dojo/dom-style',
    'dojo/dom-construct', 'dojo/_base/array', 'dojo/_base/lang', 'dojo/text', 'dojo/json', 'dojo/html', 'dojo/_base/event',
    'BootstrapMultiselect/lib/jquery-1.11.2', 'BootstrapMultiselect/lib/bootstrap-multiselect',
    'dojo/text!BootstrapMultiselect/widget/template/BootstrapMultiselect.html'
], function (declare, _WidgetBase, _TemplatedMixin,
    dom, dojoDom, domQuery, domProp, domGeom, domClass, domStyle,
    domConstruct, dojoArray, lang, text, json, html, event,
    _jQuery, _multiselect, widgetTemplate) {
    'use strict';

    var $ = _jQuery.noConflict(true);

    // Declare widget's prototype.
    return declare('BootstrapMultiselect.widget.BootstrapMultiselect', [_WidgetBase, _TemplatedMixin], {

        // _TemplatedMixin will create our dom node using this HTML template.
        templateString: widgetTemplate,

        // attach points in the template
        selectNode: null,

        // Parameters configured in the Modeler.
        reference: "",
        constraint: "",
        displayAttr: "",
        sortAttr: "",
        sortOrder: "",
        limit: 0,
        dropdownLocation: "",
        filtering: "",
        selectAll: false,
        buttonClass: "",
        extraOptions: "",

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handles: null,
        _contextObj: null,
        _alertDiv: null,
        _options: {},
        _multiselectButtons: null,
        _multiselectGroups: null,

        // dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function () {
            this._handles = [];
        },

        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        postCreate: function () {
            //console.log(this.id + '.postCreate');

            this._updateRendering();
            this._setupEvents();
        },

        // mxui.widget._WidgetBase.update is called when context is changed or initialized. Implement to re-render and / or fetch data.
        update: function (obj, callback) {
            //console.log(this.id + '.update');

            this._contextObj = obj;
            this._resetSubscriptions();
            this._updateRendering();

            callback();
        },

        // mxui.widget._WidgetBase.enable is called when the widget should enable editing. Implement to enable editing if widget is input widget.
        enable: function () {},

        // mxui.widget._WidgetBase.enable is called when the widget should disable editing. Implement to disable editing if widget is input widget.
        disable: function () {},

        // mxui.widget._WidgetBase.resize is called when the page's layout is recalculated. Implement to do sizing calculations. Prefer using CSS instead.
        resize: function (box) {},

        // mxui.widget._WidgetBase.uninitialize is called when the widget is destroyed. Implement to do special tear-down work.
        uninitialize: function () {
            // Clean up listeners, helper objects, etc. There is no need to remove listeners added with this.connect / this.subscribe / this.own.
        },

        // We want to stop events on a mobile device
        _stopBubblingEventOnMobile: function (e) {
            if (typeof document.ontouchstart !== 'undefined') {
                event.stop(e);
            }
        },

        // Attach events to HTML dom elements
        _setupEvents: function () {
            if (this.dropdownLocation === "Right") {
                this._options.dropRight = true;
            }
            
            if (this.filtering === "Case") {
                this._options.enableFiltering = true;
            } else if (this.filtering === "NoCase") {
                this._options.enableCaseInsensitiveFiltering = true;
            }
            
            if (this.selectAll) {
                this._options.includeSelectAllOption = true;
            }
            
            if (this.buttonClass !== '') {
                this._options.buttonClass = this.buttonClass;
            }
            
            if (this.extraOptions !== '') {
                lang.mixin(this._options, json.parse(this.extraOptions));
            }
        },

        // Rerender the interface.
        _updateRendering: function () {
            console.log(this.id + '.updaterendering');

            if (this._multiselectNode) {
                if (this.readOnly) {
                    this._multiselectNode.multiselect('disable');
                } else {
                    this._multiselectNode.multiselect('enable');
                }
            }

            if (this._contextObj !== null) {
                domStyle.set(this.domNode, 'display', 'block');

                //default fetch
                var refEntity = this.reference.split('/')[1],
                    filters = {},
                    xpath = '//' + refEntity;

                filters.sort = [[this.sortAttr, this.sortOrder]];
                if (this.limit > 0) {
                    filters.amount = this.limit;
                }
                if (this.constraint) {
                    xpath = '//' + refEntity + this.constraint.replace('[%CurrentObject%]', this._contextObj);
                }
                mx.data.get({
                    xpath: xpath,
                    filter: filters,
                    callback: lang.hitch(this, function (objs) {
                        this._processData(objs);
                    })
                });
            } else {
                domStyle.set(this.domNode, 'display', 'none');
            }

            // Important to clear all validations!
            this._clearValidations();

            console.log(this.id + '.updaterendering - done');
        },

        /**
         * Fetching Data & Building widget
         * ======================
         */
        _processData: function (objs) {
            console.log(this.id + '.processdata');

            var data = [],
                finalLength = objs.length;

            domConstruct.empty(this.selectNode);

            dojoArray.forEach(objs, lang.hitch(this, function (obj) {
                obj.fetch(this.displayAttr, lang.hitch(this, function (display) {
                    if (typeof display === 'string') {
                        display = dom.escapeString(display);
                        //value = value.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, ' Warning! Script tags not allowed. ');
                    }

                    data.push({
                        'id': obj.getGuid(),
                        'caption': display
                    });
                    if (data.length === finalLength) {
                        this._buildTemplate(data);

                        $(this.selectNode).multiselect(this._options);

                        // grab the button and button group
                        this._multiselectGroups = domQuery(".btn-group", this.domNode);
                        this._multiselectButtons = domQuery(".multiselect", this.domNode);

                        // set up the open/close click event
                        this.connect(this._multiselectButtons[0], "click", lang.hitch(this, function (e) {
                            event.stop(e);

                            domClass.toggle(this._multiselectGroups[0], "open");
                        }));

                        console.log(this.id + '.processdata - multiselect done');
                    }
                }));
            }));

            console.log(this.id + '.processdata - done');
        },

        _buildTemplate: function (rows) {
            console.log(this.id + '.buildtemplate');

            dojoArray.forEach(rows, lang.hitch(this, function (rowData) {
                var row = domConstruct.create('option', {
                    id: this.domNode.id + '_' + rowData.id,
                    value: rowData.id,
                    innerHTML: rowData.caption
                }, this.selectNode);
            }));

            //this._setReferencedBoxes(this._contextObj.getReferences(this.reference.split('/')[0]));

            console.log(this.id + '.buildtemplate - done');
        },

        // Handle validations.
        _handleValidation: function (_validations) {
            this._clearValidations();

            var _validation = _validations[0],
                _message = _validation.getReasonByAttribute(this.reference.split('/')[0]);

            if (this.readOnly) {
                _validation.removeAttribute(this.reference.split('/')[0]);
            } else {
                if (_message) {
                    this._addValidation(_message);
                    _validation.removeAttribute(this.reference.split('/')[0]);
                }
            }
        },

        // Clear validations.
        _clearValidations: function () {
            domConstruct.destroy(this._alertdiv);
            this._alertdiv = null;
        },

        // Show an error message.
        _showError: function (message) {
            if (this._alertDiv !== null) {
                html.set(this._alertDiv, message);
                return true;
            }
            this._alertDiv = domConstruct.create("div", {
                'class': 'alert alert-danger',
                'innerHTML': message
            });
            domConstruct.place(this.domNode, this._alertdiv);
        },

        // Add a validation.
        _addValidation: function (message) {
            this._showError(message);
        },

        // Reset subscriptions.
        _resetSubscriptions: function () {
            var _entHandle = null,
                _objectHandle = null,
                _attrHandle = null,
                _validationHandle = null;

            // Release handles on previous object, if any.
            if (this._handles) {
                this._handles.forEach(function (handle, i) {
                    mx.data.unsubscribe(handle);
                });
                this._handles = [];
            }

            // When a mendix object exists create subscribtions. 
            if (this._contextObj) {
                _entHandle = this.subscribe({
                    entity: this.reference.split('/')[1],
                    callback: lang.hitch(this, function () {
                        this._updateRendering();
                    })
                });

                _objectHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: lang.hitch(this, function (guid) {
                        this._updateRendering();
                    })
                });

                _attrHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    attr: this.reference.split('/')[0],
                    callback: lang.hitch(this, function (guid, attr, attrValue) {
                        this._updateRendering();
                    })
                });

                _validationHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    val: true,
                    callback: lang.hitch(this, this._handleValidation)
                });

                this._handles = [_entHandle, _objectHandle, _attrHandle, _validationHandle];
            }
        }
    });
});
require(['BootstrapMultiselect/widget/BootstrapMultiselect'], function () {
    'use strict';
});