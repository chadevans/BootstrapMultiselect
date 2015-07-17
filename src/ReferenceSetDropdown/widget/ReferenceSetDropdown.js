/*jslint white:true, nomen: true, plusplus: true */
/*global mx, define, require, browser, devel, console, document, jQuery */
/*mendix */
/*
    ReferenceSetDropdown
    ========================

    @file      : ReferenceSetDropdown.js
    @version   : 0.4
    @author    : Chad Evans
    @date      : 17 Jul 2015
    @copyright : 2015, Mendix B.v.
    @license   : Apache v2

    Documentation
    ========================
    A dropdown reference set selector input control, for use with many-to-many relationships.
*/

// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
define([
    'dojo/_base/declare', 'mxui/widget/_WidgetBase', 'dijit/_TemplatedMixin',
    'mxui/dom', 'dojo/dom', 'dojo/query', 'dojo/dom-prop', 'dojo/dom-geometry', 'dojo/dom-class', 'dojo/dom-style',
    'dojo/dom-construct', 'dojo/_base/array', 'dojo/_base/lang', 'dojo/text', 'dojo/json', 'dojo/html', 'dojo/_base/event',
    'ReferenceSetDropdown/lib/jquery-1.11.2', 'ReferenceSetDropdown/lib/bootstrap-multiselect',
    'dojo/text!ReferenceSetDropdown/widget/template/ReferenceSetDropdown.html'
], function (declare, _WidgetBase, _TemplatedMixin,
    dom, dojoDom, domQuery, domProp, domGeom, domClass, domStyle,
    domConstruct, dojoArray, lang, text, json, html, event,
    _jQuery, _multiselect, widgetTemplate) {
    'use strict';

    var $ = _jQuery.noConflict(true);

    // Declare widget's prototype.
    return declare('ReferenceSetDropdown.widget.ReferenceSetDropdown', [_WidgetBase, _TemplatedMixin], {

        // _TemplatedMixin will create our dom node using this HTML template.
        templateString: widgetTemplate,

        // attach points in the template
        selectNode: null,
        alertNode: null,

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
        _refGuids: [],
        _referenceEntity: null,
        _referencePath: null,
        _createdWidget: null,
        _multiselectButtons: null,
        _multiselectGroups: null,

        // dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function () {
            this._handles = [];
        },

        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        postCreate: function () {
            console.log(this.id + '.postCreate');

            this._updateRendering();
            this._setupEvents();
        },

        // mxui.widget._WidgetBase.update is called when context is changed or initialized. Implement to re-render and / or fetch data.
        update: function (obj, callback) {
            console.log(this.id + '.update');

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
            this._referenceEntity = this.reference.split('/')[1];
            this._referencePath = this.reference.split('/')[0];
        },

        // Get the configuration options
        _getOptions: function () {
            var options = {};

            options.onChange = lang.hitch(this, this._referenceChange);
            options.onSelectAll = lang.hitch(this, this._referenceAllChange);

            if (this.dropdownLocation === "Right") {
                options.dropRight = true;
            }

            if (this.filtering === "Case") {
                options.enableFiltering = true;
            } else if (this.filtering === "NoCase") {
                options.enableCaseInsensitiveFiltering = true;
            }

            if (this.selectAll) {
                options.includeSelectAllOption = true;
            }

            if (this.buttonClass !== '') {
                options.buttonClass = this.buttonClass;
            }

            if (this.extraOptions !== '') {
                lang.mixin(options, json.parse(this.extraOptions));
            }

            return options;
        },

        // Rerender the interface.
        _updateRendering: function () {
            if (this._contextObj !== null) {
                domStyle.set(this.domNode, 'display', 'block');

                //default fetch
                var filters = {},
                    xpath = '//' + this._referenceEntity;

                filters.sort = [[this.sortAttr, this.sortOrder]];
                if (this.limit > 0) {
                    filters.amount = this.limit;
                }
                if (this.constraint) {
                    xpath = xpath + this.constraint.replace('[%CurrentObject%]', this._contextObj);
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
        },

        /**
         * Fetching Data & Building widget
         * ======================
         */
        _processData: function (objs) {
            var data = [],
                finalLength = objs.length;

            domConstruct.empty(this.selectNode);

            dojoArray.forEach(objs, lang.hitch(this, function (obj) {
                obj.fetch(this.displayAttr, lang.hitch(this, function (display) {
                    if (typeof display === 'string') {
                        display = dom.escapeString(display);
                        //value = value.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, ' Warning! Script tags not allowed. ');
                    }

                    this._refGuids.push(obj.getGuid());
                    data.push({
                        'id': obj.getGuid(),
                        'caption': display
                    });
                    if (data.length === finalLength) {
                        this._buildTemplate(data);

                        if (this._createdWidget) {
                            this._createdWidget.multiselect('destroy');
                        }

                        this._createdWidget = $(this.selectNode).multiselect(this._getOptions());

                        if (this._createdWidget) {
                            if (this.readOnly) {
                                this._createdWidget.multiselect('disable');
                            } else {
                                this._createdWidget.multiselect('enable');
                            }
                        }

                        // grab the button and button group
                        this._multiselectGroups = domQuery(".btn-group", this.domNode);
                        this._multiselectButtons = domQuery(".multiselect", this.domNode);

                        // set up the open/close click event
                        this.connect(this._multiselectButtons[0], "click touchstart", lang.hitch(this, function (e) {
                            this._stopBubblingEventOnMobile(e);

                            domClass.toggle(this._multiselectGroups[0], "open");
                        }));
                    }
                }));
            }));
        },

        _buildTemplate: function (rows) {
            var guids = this._contextObj.getReferences(this._referencePath);

            dojoArray.forEach(rows, lang.hitch(this, function (row) {
                var settings = {
                    id: this.domNode.id + '_' + row.id,
                    value: row.id,
                    innerHTML: row.caption
                };

                if (guids.indexOf(settings.value) > -1) {
                    settings.selected = "selected";
                }

                domConstruct.create('option', settings, this.selectNode);
            }));
        },

        _referenceChange: function (option, checked) {
            console.log(this.id + '.ref ' + this._contextObj.getGuid());

            var guid = $(option).val();
            if (checked) {
                // add the reference to the object
                this._contextObj.addReferences(this._referencePath, [guid]);
            } else {
                // remove the reference to the object
                this._contextObj.removeReferences(this._referencePath, [guid]);
            }
        },

        _referenceAllChange: function (checked) {
            console.log(this.id + '.refAll ' + this._contextObj.getGuid());

            var guids;
            if (checked) {
                // add all references
                guids = this._refGuids;
                this._contextObj.addReferences(this._referencePath, guids);
            } else {
                // remove all references
                guids = this._contextObj.getReferences(this._referencePath);
                this._contextObj.removeReferences(this._referencePath, guids);
            }
        },

        // Handle validations.
        _handleValidation: function (_validations) {
            this._clearValidations();

            var _validation = _validations[0],
                _message = _validation.getReasonByAttribute(this._referencePath);

            if (this.readOnly) {
                _validation.removeAttribute(this._referencePath);
            } else {
                if (_message) {
                    this._addValidation(_message);
                    _validation.removeAttribute(this._referencePath);
                }
            }
        },

        // Clear validations.
        _clearValidations: function () {
            domConstruct.empty(this.alertNode);
            domStyle.set(this.alertNode, 'display', 'none');
        },

        // Show an error message.
        _showError: function (message) {
            html.set(this.alertNode, message);
            domStyle.set(this.alertNode, 'display', 'block');
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
                    entity: this._referenceEntity,
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
                    attr: this._referencePath,
                    callback: lang.hitch(this, function (guid, attr, attrValue) {
                        this._updateRendering();
                    })
                });

                _validationHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    val: true,
                    callback: lang.hitch(this, function (validations) {
                        this._handleValidation(validations);
                    })
                });

                this._handles = [_entHandle, _objectHandle, _attrHandle, _validationHandle];
            }
        }
    });
});
require(['ReferenceSetDropdown/widget/ReferenceSetDropdown'], function () {
    'use strict';
});