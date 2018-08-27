angular.module('ngDocker', [])
.service('ngDockerUtil', [function() {
    var that = this;

    this.findPanelLayouts = function(layout) {
        var result = [];
        var f = function(layout) {
            if(layout.split) {
                layout.children.forEach(f);
            } else {
                result.push(layout);
            }
        };
        f(layout);
        return result;
    };

    this.validateTemplate = function(template) {
        if(template.templateUrl === undefined && template.template === undefined) {
            throw new Error('templateUrl or template must be defined for a normal panel');
        }
        if(template.templateUrl !== undefined && typeof template.templateUrl !== 'string') {
            throw new Error('templateUrl must be a string');
        }
        if(template.template !== undefined && typeof template.template !== 'string') {
            throw new Error('template must be a string');
        }
        if(template.controller !== undefined && (typeof template.controller !== 'function' && typeof template.controller !== 'string')) {
            throw new Error('controller must be a string or function');
        }
        if(template.inject !== undefined) {
            if(typeof template.inject !== 'object') {
                throw new Error('inject must be an object');
            } else {
                ['closeThisPanel'].forEach(function(k) {
                    if(template.inject[k]) {
                        throw new Error('\'' + k + '\' cannot be injected, it is reserved for ngDocker');
                    }
                });
            }
        }
    };

    this.validateLayout = function(layout) {
        if(!layout) {
            return;
        }
        if(typeof layout !== 'object') {
            throw new Error('Layout must be an object');
        }
        if(layout.data !== undefined && typeof layout.data !== 'object') {
            throw new Error('data must be an object');
        }
        if(layout.split !== undefined) {
            switch(layout.split) {
                case 'horizontal':
                case 'vertical':
                    if(layout.ratio === undefined) {
                        throw new Error('ratio must be defined for a horizontal or vertical split');
                    }
                    if(typeof layout.ratio !== 'number') {
                        throw new Error('ratio must be a number');
                    }
                    if(layout.ratio < 0 || layout.ratio > 1) {
                        throw new Error('ratio must be at least 0 and at most 1');
                    }
                    break;
                case 'tabs':
                    if(layout.ratio !== undefined) {
                        throw new Error('ratio is not valid for a tabs split');
                    }
                    if(layout.activeTabIndex === undefined) {
                        throw new Error('activeTabIndex must be defined for a tabs split');
                    }
                    if(layout.activeTabIndex < 0 || layout.activeTabIndex >= layout.children.length) {
                        throw new Error('activeTabIndex out of bounds');
                    }
                    break;
                default:
                    throw new Error('Invalid split type \'' + layout.split + '\'');
            }
            if(!(layout.children instanceof Array)) {
                throw new Error('split must define a children array');
            }
            switch(layout.split) {
                case 'horizontal':
                case 'vertical':
                    if(layout.children.length !== 2) {
                        throw new Error('length of children must be 2 for a horizontal or vertical split');
                    }
                    break;
                case 'tabs':
                    if(layout.children.length < 2) {
                        throw new Error('length of children must be at least 2 for a tabs split');
                    }
                    break;
                default:
                    validationFail();
            }
            layout.children.forEach(this.validateLayout.bind(this));
        } else {
            if(layout.id === undefined) {
                throw new Error('id must be defined for a panel');
            }
            if(typeof layout.id !== 'string') {
                throw new Error('id must be a string');
            }
            if(layout.caption === undefined) {
                throw new Error('caption must be defined for a panel');
            }
            if(typeof layout.caption !== 'string') {
                throw new Error('caption must be a string');
            }
            if(layout.icon !== undefined) {
                if(typeof layout.icon !== 'object') {
                    throw new Error('icon must be an object');
                }
                this.validateTemplate(layout.icon);
            }
            if(layout.panel === undefined) {
                throw new Error('panel must be defined for a panel');
            }
            if(typeof layout.panel !== 'object') {
                throw new Error('panel must be an object');
            }
            this.validateTemplate(layout.panel);
        }
        var seenIds = {};
        this.findPanelLayouts(layout).forEach(function(layout) {
            if(seenIds[layout.id]) {
                throw new Error('Duplicate panel id \'' + layout.id + '\'');
            } else {
                seenIds[layout.id] = true;
            }
        });
    };	

    this.computeLayoutCaption = function(layout) {
        if(layout.split !== undefined) {
            return layout.children.map(this.computeLayoutCaption.bind(this)).join(', ');
        } else {
            return layout.caption;
        }
    };

    this.cloneTemplate = function(template) {
        var result = {};
        if(template.template !== undefined) {
            result.template = template.template;
        }
        if(template.templateUrl !== undefined) {
            result.templateUrl = template.templateUrl;
        }
        if(template.controller !== undefined) {
            result.controller = template.controller;
        }
        if(template.inject !== undefined) {
            result.inject = {};
            Object.keys(template.inject).forEach(function(k) {
                result.inject[k] = template.inject[k];
            });
        }
        return result;
    };

    this.templatesEqual = function(a, b) {
        if(a.templateUrl !== b.templateUrl || a.template !== b.template) {
            return false;
        } 
        if(a.controller !== b.controller) {
            return false;
        }
        if(a.inject === undefined && b.inject !== undefined) {
            return false;
        }
        if(a.inject !== undefined && b.inject === undefined) {
            return false;
        } 
        if(a.inject !== undefined && b.inject !== undefined) {
            if(!Object.keys(a.inject).reduce(function(accum, k) {
                return accum && a.inject[k] === b.inject[k];
            }, true)) {
                return false;
            }
            if(!Object.keys(b.inject).reduce(function(accum, k) {
                return accum && a.inject[k] === b.inject[k];
            }, true)) {
                return false;
            }
        }
        return true;
    };

    this.cloneLayout = function(layout) {
        if(layout === null) {
            return null;
        } else {
            var result = {};
            if(layout.split !== undefined) {
                result.split = layout.split;
                switch(layout.split) {
                    case 'vertical':
                    case 'horizontal':
                        result.ratio = layout.ratio;
                        break;
                    case 'tabs':
                        result.activeTabIndex = layout.activeTabIndex;
                        break;
                    default:
                        validationFail();
                }
                result.children = layout.children.map(this.cloneLayout.bind(this));
            } else {
                result.id = layout.id;
                result.caption = layout.caption;
                result.panel = this.cloneTemplate(layout.panel);
                if(layout.icon !== undefined) {
                    result.icon = this.cloneTemplate(layout.icon);
                }
            }
            if(layout.data !== undefined) {
                result.data = {};
                Object.keys(layout.data).forEach(function(k) {
                    result.data[k] = layout.data[k];
                });
            }
            return result;
        }
    };

    this.layoutsEqual = function(a, b) {
        if(a !== null && b === null) {
            return false;
        } else if(a === null && b !== null) {
            return false;
        } else if(a !== null && b !== null) {
            if(a.split !== undefined && b.split === undefined) {
                return false;
            } else if(a.split === undefined && b.split !== undefined) {
                return false;
            } else if(a.split === undefined && b.split === undefined) {
                if(a.id !== b.id) {
                    return false;
                } else if(a.caption !== b.caption) {
                    return false;
                } else if(a.icon === undefined && b.icon !== undefined 
                    || a.icon !== undefined && b.icon === undefined 
                    || a.icon !== undefined && b.icon !== undefined && !this.templatesEqual(a.icon, b.icon)) 
                {
                    return false;
                } else if(!this.templatesEqual(a.panel, b.panel)) {
                    return false;
                }
            } else { // a.split !== undefined && b.split !== undefined
                if(a.split !== b.split) {
                    return false;
                } else if(a.split === 'tabs' && a.activeTabIndex !== b.activeTabIndex) {
                    return false;
                } else if((a.split === 'horizontal' || a.split === 'vertical') && a.ratio !== b.ratio) {
                    return false;
                } else if(a.children.length !== b.children.length) {
                    return false;
                }
                for(var i = 0; i !== a.children.length; ++i) {
                    if(!this.layoutsEqual(a.children[i], b.children[i])) {
                        return false;
                    }
                }
            }
            if(a.data !== undefined && b.data === undefined) {
                return false;
            } else if(a.data === undefined && b.data !== undefined) {
                return false;
            } else if(a.data !== undefined && b.data !== undefined) {
                if(!Object.keys(a.data).reduce(function(accum, k) {
                    return accum && a.data[k] === b.data[k];
                }, true)) {
                    return false;
                }
                if(!Object.keys(b.data).reduce(function(accum, k) {
                    return accum && a.data[k] === b.data[k];
                }, true)) {
                    return false;
                }
            }
        }
        return true;
    };

    this.findLayoutParentAndIndex = function(rootLayout, layout) {
        var that = this;
        if(this.layoutsEqual(rootLayout, layout)) {
            return null; // Layout is root (no parent)
        } else if(rootLayout.split !== undefined) {
            var f = function(l) {
                for(var i = 0; i !== l.children.length; ++i) {
                    var child = l.children[i];
                    if(that.layoutsEqual(child, layout)) {
                        return [l, i];
                    } else {
                        if(child.split !== undefined) {
                            var result = f(child);
                            if(result !== undefined) {
                                return result;
                            }
                        }
                    }
                }
                return undefined;
            };
            var result = f(rootLayout);
            if(result !== undefined) {
                return result;
            }
        } 
        return undefined; // Failed to find layout
    };

    this.findPanelLayoutWithId = function(layout, id) {
        if(layout === null) {
            return null;
        } else {
            var f = function(l) {
                if(l.split !== undefined) {
                    for(var i = 0; i !== l.children.length; ++i) {
                        var result = f(l.children[i]);
                        if(result !== null) {
                            return result;
                        }
                    }
                    return null;
                } else if(l.id === id) {
                    return l;
                } else {
                    return null;
                }
            };
            return f(layout);
        }
    };

    this.validationFail = function() {
        throw new Error('This case was supposed to be rejected by input validation');
    };

    // returns the new root layout
    this.removeSplitChild = function(rootLayout, layout, index) {
        if(layout.split === undefined) {
            throw new Error('removeSplitChild only valid on splits');
        }	
        layout.children.splice(index, 1);
        if(layout.split === 'tabs' && layout.activeTabIndex >= layout.children.length) {
            --layout.activeTabIndex;
        }
        if(layout.children.length < 2) {
            if(layout.children.length === 1) {
                var p = this.findLayoutParentAndIndex(rootLayout, layout);
                if(p === null) {
                    rootLayout = layout.children[0];
                } else {
                    p[0].children[p[1]] = layout.children[0];
                }
            } else {
                this.validationFail();
            }
        }
        return rootLayout;
    };

    // returns the new root layout
    this.removeLayout = function(rootLayout, layout) {
        var p = this.findLayoutParentAndIndex(rootLayout, layout);
        if(p === null) {
            rootLayout = null;
        } else {
            rootLayout = this.removeSplitChild(rootLayout, p[0], p[1]);
        }
        return rootLayout;
    };

    // returns the new root layout
    this.removePanelLayoutById = function(rootLayout, id) {
        var panelLayouts = this.findPanelLayouts(rootLayout);
        for(var i = 0; i !== panelLayouts.length; ++i) {
            var panelLayout = panelLayouts[i];
            if(panelLayout.id === id) {
                var p = this.findLayoutParentAndIndex(rootLayout, panelLayout);
                if(p === null) {
                    // root panel removed
                    rootLayout = null;
                } else {
                    rootLayout = this.removeSplitChild(rootLayout, p[0], p[1]);
                }
            }
        }
        return rootLayout;
    };
}])
.directive('ngDocker', ['$parse', '$compile', '$templateCache', '$templateRequest', '$q', '$exceptionHandler', '$controller', 'ngDockerUtil', function($parse, $compile, $templateCache, $templateRequest, $q, $exceptionHandler, $controller, ngDockerUtil) {
    return {
        restrict: 'E',
        scope: true,
        link: function($scope, $element, $attr) {
            if(!jQuery) {
                throw new Error('ngDocker requires jQuery');
            }
            var tabNavRightPadding = 20; // given a full tab nav bar, how much space to leave at the right to allow the user to drag it
            var headerDragThreshold = 5;
            var floatingContainerCursorOffset = {
                left: -10,
                top: -10
            };
            var initialTabWidth = 200;
            var defaultDropSplitRatio = 0.3333333;
            var allContainerHTML = 
                '<div class="ng-docker-all-container"></div>';
            var floatingContainerHTML =
                '<div class="ng-docker-floating-container"></div>';
            var panelContainerHTML = 
                '<div class="ng-docker-panel-container">' +
                '<div class="ng-docker-header ng-docker-title-container">' +
                '<div class="ng-docker-title">' +
                '<div class="ng-docker-icon"></div>' +
                '</div>' +
                '<div class="ng-docker-close"></div>' +
                '</div>' +
                '<div class="ng-docker-contents"></div>' +	
                '</div>';
            var vsplitHTML = 
                '<div class="ng-docker-vsplit">' +
                '<div class="ng-docker-left"></div>' +
                '<div class="ng-docker-separator ng-docker-vsplit-separator"></div>' +
                '<div class="ng-docker-right"></div>' +
                '</div>';
            var hsplitHTML = 
                '<div class="ng-docker-hsplit">' +
                '<div class="ng-docker-top"></div>' +
                '<div class="ng-docker-separator ng-docker-hsplit-separator"></div>' +
                '<div class="ng-docker-bottom"></div>' +
                '</div>';
            var tabsplitHTML = 
                '<div class="ng-docker-tabsplit">' +
                '<div class="ng-docker-tab-nav">' +
                '<div class="ng-docker-tab-nav-border ng-docker-tab-nav-border-left"></div>' +
                '<div class="ng-docker-tab-nav-border ng-docker-tab-nav-border-right"></div>' +
                '</div>' +
                '<div class="ng-docker-contents"></div>' +
                '</div>';
            var tabHTML =
                '<div class="ng-docker-tab ng-docker-title-container">' +
                '<div class="ng-docker-title">' +
                '<div class="ng-docker-icon"></div>' +
                '</div>' +
                '<div class="ng-docker-close"></div>' +
                '</div>';
            var hiddenHTML =
                '<div class="ng-docker-hidden"></div>';
            var dropVisualTopHTML =
                '<div class="ng-docker-drop-visual ng-docker-abs-drop-visual ng-docker-drop-visual-top"></div>';
            var dropVisualRightHTML = 
                '<div class="ng-docker-drop-visual ng-docker-abs-drop-visual ng-docker-drop-visual-right"></div>';
            var dropVisualBottomHTML =
                '<div class="ng-docker-drop-visual ng-docker-abs-drop-visual ng-docker-drop-visual-bottom"></div>';
            var dropVisualLeftHTML = 
                '<div class="ng-docker-drop-visual ng-docker-abs-drop-visual ng-docker-drop-visual-left"></div>';
            var dropVisualWholeHTML =
                '<div class="ng-docker-drop-visual ng-docker-abs-drop-visual ng-docker-drop-visual-whole"><div>'; 
            var dropVisualTabHTML =
                '<div class="ng-docker-drop-visual ng-docker-drop-visual-tab"></div>';
            var dropVisualTabOnPanelHTML = 
                '<div class="ng-docker-drop-visual ng-docker-drop-visual-tab-on-panel"></div>';
            var icons = {};
            var panels = {};
            var templateRequestPack = null;
            var floatingState = null;
            var dragListeners = {};

            var TemplateRequestPack = function() {
                this._promises = [];
                this._aborted = false;
            };

            TemplateRequestPack.AbortedException = function() {};

            TemplateRequestPack.prototype.add = function(templateUrl) {
                if(this._aborted) {
                    throw new Error('Cannot add template requests to an aborted TemplateRequestPack');
                }
                this._promises.push($templateRequest(templateUrl));
            };

            TemplateRequestPack.prototype.finalize = function() {
                var that = this;
                return $q.all(this._promises).then(function() {
                    if(that._aborted) {
                        throw new TemplateRequestPack.AbortedException();
                    }
                });
            };

            TemplateRequestPack.prototype.abort = function() {
                this._aborted = true;
            };

            var validationFail = function() {
                ngDockerUtil.validationFail();
            };

            var cloneFloatingState = function(floatingState) {
                if(floatingState === null) {
                    return null;
                } else {
                    return {
                        layout: ngDockerUtil.cloneLayout(floatingState.layout),
                        cursorPosition: {
                            pageX: floatingState.cursorPosition.pageX,
                            pageY: floatingState.cursorPosition.pageY
                        }
                    };
                }
            };

            var floatingStatesEqual = function(a, b) {
                if(a !== null && b === null || a === null && b !== null) {
                    return false;
                } else if(a !== null && b !== null) {
                    if(!ngDockerUtil.layoutsEqual(a.layout, b.layout)) {
                        return false;
                    }
                    if(a.cursorPosition.pageX !== b.cursorPosition.pageX
                        || a.cursorPosition.pageY !== b.cursorPosition.pageY)
                    {
                        return false;
                    }
                }
                return true;
            };

            // everything below this point assumes a dependency on layoutGet/layoutSet
            var layoutGetRaw = $parse($attr.layout);
            var layoutGet = function(obj) {
                // convert falsy layouts to null
                var result = layoutGetRaw(obj);
                return result ? result : null;
            };
            var layoutSet = layoutGetRaw.assign;
            if(!layoutSet) {
                throw new Error('layout must be assignable');
            }

            var layoutScope = $scope;
            while(!layoutScope.hasOwnProperty($attr.layout)) {
                layoutScope = Object.getPrototypeOf(layoutScope);
                if(layoutScope === null) {
                    throw new Error('\'' + $attr.layout + '\' must be defined in either the current scope or any parent scopes');
                }
            }

            var findLayoutParentAndIndex = function(layout) {
                var p = ngDockerUtil.findLayoutParentAndIndex(layoutGet(layoutScope), layout);
                if(p === undefined) {
                    throw new Error('Failed to find layout');
                } else {
                    return p;
                }
            };

            // returns the DOM element whose ngDockerLayout == layout, or null if no such element exists
            var findElementWithLayout = function(layout) {
                var f = function(element) {
                    var elementLayout = element.data('ngDockerLayout');
                    if(elementLayout !== undefined && ngDockerUtil.layoutsEqual(elementLayout, layout)) {
                        return element;
                    } else {
                        var children = element.children();
                        for(var i = 0; i !== children.length; ++i) {
                            var result = f(jQuery(children[i]));
                            if(result !== null) {
                                return result;
                            }
                        }
                        return null;
                    }
                };
                return f($element.children('.ng-docker-all-container'));
            };

            // returns the DOM element where the drop visual should be inserted into as a child
            var findDropVisualParentElement = function(layout) {
                if(layout === null) {
                    return $element;
                } else if(layout.split !== undefined) {
                    return findElementWithLayout(layout);
                } else { 
                    var panel = panels[layout.id];
                    if(panel !== undefined && panel.parent().length > 0) {
                        var p = findLayoutParentAndIndex(layout);
                        if(p === null || p[0].split !== 'tabs') {
                            // panel is wrapped in panelContainerHTML, provide .ng-docker-panel-container
                            return panel.parent().parent();
                        } else {
                            // panel is wrapped inside a tabsplitHTML, provide .ng-docker-contents
                            return panel.parent(); 
                        }
                    } else {
                        return null;
                    }
                }
            };

            var findLayoutHeaderElement = function(layout) {
                if(layout.split !== undefined) {
                    switch(layout.split) {
                        case 'vertical':
                        case 'horizontal':
                            // vertical/horizontal splits do not have a header
                            return null;
                        case 'tabs':
                            {
                                var element = findElementWithLayout(layout);
                                if(element !== null) {
                                    return element.children('.ng-docker-tab-nav');
                                } else {
                                    return null;
                                }
                            }
                            break;
                        default:
                            validationFail();
                    }
                } else {
                    var panel = panels[layout.id];
                    if(panel !== undefined && panel.parent().length > 0) {
                        var p = findLayoutParentAndIndex(layout);
                        if(p === null || p[0].split !== 'tabs') {
                            // panel is wrapped in panelContainerHTML, provide .ng-docker-header
                            return panel.parent().parent().children('.ng-docker-header');
                        } else {
                            // panel is wrapped inside a tabsplitHTML, it does not have its own header
                            return null;
                        }
                    } else {
                        return null;
                    }
                }
            };

            var replaceLayout = function(layout, replacement) {
                var p = findLayoutParentAndIndex(layout);
                if(p === null) {
                    layoutSet(layoutScope, replacement);
                } else {
                    p[0].children[p[1]] = replacement;
                }
            };

            var removeSplitChild = function(layout, index) {
                layoutSet(layoutScope, ngDockerUtil.removeSplitChild(layoutGet(layoutScope), layout, index));
            };

            var removePanelLayoutById = function(id) {
                layoutSet(layoutScope, ngDockerUtil.removePanelLayoutById(layoutGet(layoutScope), id));
            };

            var removeLayout = function(layout) {
                layoutSet(layoutScope, ngDockerUtil.removeLayout(layoutGet(layoutScope), layout));
            };

            // get the angular template string from a template
            var getTemplateTemplateString = function(template) {
                return template.templateUrl ? $templateCache.get(template.templateUrl) : template.template;
            }

            var newTemplateScope = function(template) {
                var scope = $scope.$new();
                if(template.inject !== undefined) {
                    Object.keys(template.inject).forEach(function(k) {
                        scope[k] = template.inject[k];
                    });
                }
                return scope;
            };

            var maybeLoadTemplateController = function(template, scope, element) {
                if(template.controller !== undefined) {
                    var controllerInstance = $controller(template.controller, {
                        $scope: scope,
                        $element: element
                    });
                    element.data('$ngDockerPanelController', controllerInstance);
                }
            };

            var computeDropSplitWhere = function(element) {
                var x = floatingState.cursorPosition.pageX - element.offset().left;
                var y = floatingState.cursorPosition.pageY - element.offset().top;
                var y1 = element.height()/element.width()*x;
                var y2 = -element.height()/element.width()*x + element.height();
                var where;
                if(y < y1 && y < y2) {
                    return 'top';
                } else if(y < y1 && y > y2) {
                    return 'right';
                } else if(y > y1 && y < y2) {
                    return 'left';
                } else { // y > y1 && y > y2
                    return 'bottom';
                }
            };

            var computeDropTarget = function() { 
                if(floatingState === null) {
                    throw new Error('A floating state must exist to compute a drop target');
                }
                var allLayout = layoutGet(layoutScope);
                if(allLayout === null) {
                    // drop as root
                    return {
                        where: 'whole',
                        layout: null
                    };
                } else {
                    // check panels (for vertical/horizontal split)
                    {
                        var panelIds = ngDockerUtil.findPanelLayouts(allLayout).map(function(l) {
                            return l.id;
                        });
                        for(var i = 0; i !== panelIds.length; ++i) {
                            var panel = panels[panelIds[i]];
                            var container = panel.parent();
                            if(container.length > 0) {
                                if(floatingState.cursorPosition.pageX >= container.offset().left && floatingState.cursorPosition.pageX < container.offset().left + container.width()
                                    && floatingState.cursorPosition.pageY >= container.offset().top && floatingState.cursorPosition.pageY < container.offset().top + container.height())
                                {
                                    return {
                                        where: computeDropSplitWhere(container),
                                        layout: panel.data('ngDockerLayout')
                                    };
                                }
                            }
                        }
                    }
                    // check headers (for tabs split)
                    {
                        var f = function(layout) {
                            var header = findLayoutHeaderElement(layout);
                            if(header !== null) {
                                if(layout.split === 'tabs') {
                                    if(floatingState.cursorPosition.pageX >= header.offset().left && floatingState.cursorPosition.pageX < header.offset().left + header.width()
                                        && floatingState.cursorPosition.pageY >= header.offset().top && floatingState.cursorPosition.pageY < header.offset().top + header.height())
                                    {
                                        var tabs = header.children('.ng-docker-tab');
                                        for(var i = 0; i !== tabs.length; ++i) {
                                            var tab = jQuery(tabs[i]);
                                            if(floatingState.cursorPosition.pageX >= tab.offset().left && floatingState.cursorPosition.pageX < tab.offset().left + tab.width()
                                                && floatingState.cursorPosition.pageY >= tab.offset().top && floatingState.cursorPosition.pageY < tab.offset().top + tab.height())
                                            {
                                                var tabIndex;
                                                if(floatingState.cursorPosition.pageX < tab.offset().left + tab.width()/2) {
                                                    tabIndex = i;
                                                } else {
                                                    tabIndex = i+1;
                                                }
                                                return {
                                                    where: 'tab',
                                                    tabIndex: tabIndex,
                                                    layout: layout
                                                };
                                            }
                                        }
                                        return {
                                            where: 'tab',
                                            tabIndex: layout.children.length,
                                            layout: layout
                                        };
                                    }
                                } else {
                                    if(layout.split !== undefined) {
                                        throw new Error('Unexpected header on a ' + layout.split + ' split');
                                    }
                                    if(floatingState.cursorPosition.pageX >= header.offset().left && floatingState.cursorPosition.pageX < header.offset().left + header.width()
                                        && floatingState.cursorPosition.pageY >= header.offset().top && floatingState.cursorPosition.pageY < header.offset().top + header.height())
                                    {
                                        return {
                                            where: 'tab',
                                            tabIndex: 1,
                                            layout: layout
                                        };
                                    }
                                }
                            }
                            if(layout.split !== undefined) {
                                for(var i = 0; i !== layout.children.length; ++i) {
                                    var result = f(layout.children[i]);
                                    if(result !== null) {
                                        return result;
                                    }
                                }
                            }
                            return null;
                        };
                        var result = f(allLayout);
                        if(result !== null) {
                            return result;
                        }
                    }
                    // assume root (for vertical/horizontal split at root)
                    {
                        return {
                            where: computeDropSplitWhere($element),
                            layout: allLayout
                        };
                    }
                    return null; 
                }
            };

            var dropFloatingLayoutIntoTarget = function(target) {
                if(floatingState === null) {
                    throw new Error('A floating state must exist to drop its layout into a target');
                }
                switch(target.where) {
                    case 'top':
                        replaceLayout(target.layout, {
                            split: 'horizontal',
                            ratio: floatingState.dropSplitRatio,
                            children: [
                                floatingState.layout,
                                target.layout
                            ]
                        });
                        break;
                    case 'right':
                        replaceLayout(target.layout, {
                            split: 'vertical',
                            ratio: 1-floatingState.dropSplitRatio,
                            children: [
                                target.layout,
                                floatingState.layout
                            ]
                        });
                        break;
                    case 'bottom':
                        replaceLayout(target.layout, {
                            split: 'horizontal',
                            ratio: 1-floatingState.dropSplitRatio,
                            children: [
                                target.layout,
                                floatingState.layout
                            ]
                        });
                        break;
                    case 'left':
                        replaceLayout(target.layout, {
                            split: 'vertical',
                            ratio: floatingState.dropSplitRatio,
                            children: [
                                floatingState.layout,
                                target.layout
                            ]
                        });
                        break;
                    case 'whole':
                        if(target.layout !== null) {
                            throw new Error('layout must be null when where is whole');
                        }
                        layoutSet(layoutScope, floatingState.layout);
                        break;
                    case 'tab':
                        if(target.layout.split !== undefined) {
                            if(target.layout.split !== 'tabs') {
                                throw new Error('Expected tabs split');
                            }
                            target.layout.children.splice(target.tabIndex, 0, floatingState.layout);
                            target.layout.activeTabIndex = target.tabIndex;
                        } else {
                            replaceLayout(target.layout, {
                                split: 'tabs',
                                activeTabIndex: 1,
                                children: [
                                    target.layout,
                                    floatingState.layout
                                ]
                            });
                        }
                        break;
                    default:
                        throw new Error('Unrecognized where \'' + target.where + '\'');
                }
            };

            var computeTabWidth = function(layout, headerWidth, tabIndex) {
                if(layout.split !== 'tabs') {
                    throw new Error('computeTabWidth expects layout to be a tabs split');
                }
                var w = headerWidth - tabNavRightPadding;
                if(layout.children.length*initialTabWidth < w) {
                    return initialTabWidth;
                } else {
                    return w/layout.children.length;
                }
            };

            var updateContainerTabWidths = function(container) {
                var tabsplits = container.find('.ng-docker-tabsplit');
                tabsplits.each(function() {
                    var tabsplit = jQuery(this);
                    var tabNav = tabsplit.children('.ng-docker-tab-nav');
                    var layout = tabsplit.data('ngDockerLayout');
                    var tabs = tabNav.children('.ng-docker-tab');
                    for(var i = 0; i !== layout.children.length; ++i) {
                        var tab = jQuery(tabs[i]);
                        tab.css('width', computeTabWidth(layout, tabNav.width(), i));
                    }
                    var leftBorder = tabNav.children('.ng-docker-tab-nav-border-left');
                    var rightBorder = tabNav.children('.ng-docker-tab-nav-border-right');
                    var activeTab = jQuery(tabs[layout.activeTabIndex]);
                    leftBorder.css({
                        right: tabNav.width() - activeTab.position().left
                    });
                    rightBorder.css({
                        left: activeTab.position().left + activeTab.width()
                    });
                });
            };

            var clearDropTargetVisuals = function() {
                jQuery($element[0]).find('.ng-docker-drop-visual').remove();
                updateContainerTabWidths(jQuery($element[0]).find('.ng-docker-all-container'));
                updateContainerTabWidths(jQuery($element[0]).find('.ng-docker-floating-container'));
            };

            var beginFloating = function(e, layout) {
                if(floatingState !== null) {
                    throw new Error('Cannot construct floating state while one is already present');
                }
                var p = findLayoutParentAndIndex(layout);
                var dropSplitRatio;
                if(p === null) {
                    dropSplitRatio = defaultDropSplitRatio;
                } else switch(p[0].split) {
                    case 'vertical':
                    case 'horizontal':
                        switch(p[1]) {
                            case 0:
                                dropSplitRatio = p[0].ratio;
                                break;
                            case 1:
                                dropSplitRatio = 1 - p[0].ratio;
                                break;
                            default:
                                throw new Error('Unexpected index ' + p[1]);
                        }
                        break;
                    case 'tabs':
                        dropSplitRatio = defaultDropSplitRatio;
                        break;
                    default:
                        validationFail();
                }
                removeLayout(layout);
                floatingState = {
                    layout: layout,
                    dropSplitRatio: dropSplitRatio,
                    cursorPosition: {
                        pageX: e.pageX,
                        pageY: e.pageY
                    }
                };
            };

            // mouse event handlers
            {
                var activeDragId = null;
                var activeDragStartPos = null;
                var release = function(e) {
                    if(floatingState !== null) {
                        activeDragId = null;
                        clearDropTargetVisuals();
                        var dropTarget = computeDropTarget();
                        if(dropTarget !== null) {
                            dropFloatingLayoutIntoTarget(dropTarget);
                        }
                        floatingState = null;
                        $scope.$digest();
                    } else if(activeDragId !== null) {
                        var dl = dragListeners[activeDragId];
                        if(dl === undefined) {
                            activeDragId = null;
                        } else {
                            if(dl.upHandler) {
                                dl.upHandler(e);
                                $scope.$digest();
                            }
                            activeDragId = null;
                            e.preventDefault();
                        }
                    }
                };
                $element.on('mouseup', function(e) {
                    if(e.button === 0) {
                        release(e);
                    }
                });
                $element.on('mouseleave', function(e) {
                    if(e.button === 0) {
                        release(e);
                    }
                });
                $element.on('mousemove', function(e) {
                    if(e.buttons === 1) {
                        if(floatingState !== null) {
                            activeDragId = null;
                            floatingState.cursorPosition = {
                                pageX: e.pageX,
                                pageY: e.pageY
                            };
                            $scope.$digest();
                            e.preventDefault();
                        } else if(activeDragId !== null) {
                            var dl = dragListeners[activeDragId];
                            if(dl === undefined) {
                                activeDragId = null;
                            } else {
                                var dist = Math.sqrt((e.pageX-activeDragStartPos.pageX)*(e.pageX-activeDragStartPos.pageX) + (e.pageY-activeDragStartPos.pageY)*(e.pageY-activeDragStartPos.pageY));
                                if(dl.threshold === undefined || dist >= dl.threshold) {
                                    if(dl.dragHandler) {
                                        dl.dragHandler(e);
                                        $scope.$digest();
                                    }
                                }
                                e.preventDefault();
                            }
                        }  
                    } else {
                        release(e);
                    }
                });
                $element.on('mousedown', function(e) {
                    if(e.button === 0) {
                        activeDragId = null;
                        var keys = Object.keys(dragListeners);
                        var candidates = [];
                        for(var i = 0; i !== keys.length; ++i) {
                            var dl = dragListeners[keys[i]];
                            var el = dl.element;
                            if(e.pageX >= el.offset().left && e.pageY >= el.offset().top
                                && e.pageX < el.offset().left + el.width() && e.pageY < el.offset().top + el.height())
                            {
                                candidates.push(keys[i]);
                            }
                        }
                        if(candidates.length > 0) {
                            candidates.sort(function(a, b) {
                                return dragListeners[b].priority - dragListeners[a].priority;
                            });
                            var dl = dragListeners[candidates[0]];
                            activeDragId = candidates[0];
                            activeDragStartPos = {
                                pageX: e.pageX,
                                pageY: e.pageY
                            };
                            if(dl.downHandler) {
                                dl.downHandler(e);
                                $scope.$digest();
                            }
                            e.preventDefault();
                        }
                    }
                });
            }

            var update = function() {
                if(templateRequestPack !== null) {
                    templateRequestPack.abort();
                    templateRequestPack = null;
                }

                var allLayout = layoutGet(layoutScope);

                var panelLayouts =  [];
                if(allLayout !== null) {
                    ngDockerUtil.validateLayout(allLayout);
                    Array.prototype.push.apply(panelLayouts, ngDockerUtil.findPanelLayouts(allLayout));
                }
                if(floatingState !== null) {
                    ngDockerUtil.validateLayout(floatingState.layout);
                    Array.prototype.push.apply(panelLayouts, ngDockerUtil.findPanelLayouts(floatingState.layout));
                }

                // load any uncached templates before proceeding
                templateRequestPack = new TemplateRequestPack();
                var maybeAddTemplate = function(template) {
                    if(template.templateUrl !== undefined && $templateCache.get(template.templateUrl) === undefined) {
                        templateRequestPack.add(template.templateUrl);
                    }
                };
                panelLayouts.forEach(function(layout) {
                    if(layout.icon !== undefined) {
                        maybeAddTemplate(layout.icon);
                    }
                    maybeAddTemplate(layout.panel);
                });
                templateRequestPack.finalize().then(function() {
                    templateRequestPack = null;
                    // adapt any previously constructed icons and panels to the new layout and discard any unused ones
                    {
                        var tryAdapt = function(m, panelLayoutsById) {
                            var next = {};
                            Object.keys(m).forEach(function(k) {
                                var el = m[k];
                                var elLayout = el.data('ngDockerLayout');
                                var layout = panelLayoutsById[elLayout.id];
                                if(!layout || !ngDockerUtil.layoutsEqual(layout, elLayout)) {
                                    el.scope().$destroy();
                                    el.remove();
                                } else {
                                    el.detach();
                                    next[layout.id] = el;
                                }
                            });
                            return next;
                        };
                        var panelLayoutsById = {};
                        var panelLayoutsWithIconById = {};
                        panelLayouts.forEach(function(layout) {
                            panelLayoutsById[layout.id] = layout;
                            if(layout.icon !== undefined) {
                                panelLayoutsWithIconById[layout.id] = layout;
                            }
                        });
                        icons = tryAdapt(icons, panelLayoutsWithIconById);
                        panels = tryAdapt(panels, panelLayoutsById);
                    }

                    // construct any missing icons and panels
                    panelLayouts.forEach(function(layout) {
                        if(!panels[layout.id]) {
                            var panelScope = newTemplateScope(layout.panel);
                            panelScope.closeThisPanel = function() {
                                removePanelLayoutById(layout.id);
                            };
                            var panel = $compile(getTemplateTemplateString(layout.panel))(panelScope);
                            maybeLoadTemplateController(layout.panel, panelScope, panel);
                            panel.data('ngDockerLayout', layout);
                            panels[layout.id] = panel;
                        }
                        if(layout.icon !== undefined && !icons[layout.id]) {
                            var iconScope = newTemplateScope(layout.icon);
                            var icon = $compile(getTemplateTemplateString(layout.icon))(iconScope);
                            icon.data('ngDockerLayout', layout);
                            maybeLoadTemplateController(layout.icon, iconScope, icon);
                            icons[layout.id] = icon;
                        }
                    });

                    // clear drag listeners
                    dragListeners = {};

                    // clear the constructed DOM 
                    jQuery($element[0]).children('.ng-docker-all-container, .ng-docker-floating-container, .ng-docker-drop-visual').remove();

                    // construct the new DOM
                    {
                        var dragId = 0;
                        var construct = function(layout, parent, interactive) {
                            if(layout.split !== undefined) {
                                var element;
                                switch(layout.split) {
                                    case 'vertical':
                                        {
                                            element = jQuery(vsplitHTML);
                                            var left = element.children('.ng-docker-left');
                                            var sep = element.children('.ng-docker-separator');
                                            var right = element.children('.ng-docker-right');
                                            construct(layout.children[0], left, interactive);
                                            construct(layout.children[1], right, interactive);
                                            left.css('width', 100*layout.ratio + '%');
                                            sep.css('left', 'calc(' + 100*layout.ratio + '% - 1px)');
                                            right.css('width', 100*(1-layout.ratio) + '%');
                                            if(interactive) {
                                                left.children().children('.ng-docker-header').children('.ng-docker-close').click(function() {
                                                    removeSplitChild(layout, 0);
                                                    $scope.$digest();
                                                });
                                                right.children().children('.ng-docker-header').children('.ng-docker-close').click(function() {
                                                    removeSplitChild(layout, 1);
                                                    $scope.$digest();
                                                });
                                                dragListeners[dragId++] = {
                                                    element: sep,
                                                    priority: 1,
                                                    dragHandler: function(e) {
                                                        layout.ratio = Math.max(0, Math.min(1, (e.pageX - element.offset().left)/element.width()));
                                                    }
                                                };
                                            }
                                        }
                                        break;
                                    case 'horizontal':
                                        {
                                            element = jQuery(hsplitHTML);
                                            var top = element.children('.ng-docker-top');
                                            var sep = element.children('.ng-docker-separator');
                                            var bottom = element.children('.ng-docker-bottom');
                                            construct(layout.children[0], top, interactive);
                                            construct(layout.children[1], bottom, interactive);
                                            top.css('height', 100*layout.ratio + '%');
                                            sep.css('top', 'calc(' + 100*layout.ratio + '% - 1px)');
                                            bottom.css('height', 100*(1-layout.ratio) + '%');
                                            if(interactive) {
                                                top.children().children('.ng-docker-header').children('.ng-docker-close').click(function() {
                                                    removeSplitChild(layout, 0);
                                                    $scope.$digest();
                                                });
                                                bottom.children().children('.ng-docker-header').children('.ng-docker-close').click(function() {
                                                    removeSplitChild(layout, 1);
                                                    $scope.$digest();
                                                });
                                                dragListeners[dragId++] = {
                                                    element: sep,
                                                    priority: 2,
                                                    dragHandler: function(e) {
                                                        layout.ratio = Math.max(0, Math.min(1, (e.pageY - element.offset().top)/element.height()));
                                                    }
                                                };
                                            }
                                        }
                                        break;
                                    case 'tabs':
                                        {
                                            element = jQuery(tabsplitHTML);
                                            var tabNav = element.children('.ng-docker-tab-nav');
                                            for(var i = 0; i !== layout.children.length; ++i) (function(i) {
                                                var tabLayout = layout.children[i];
                                                // note: the width for this tab is calculated after the entire DOM is built: see updateContainerTabWidths
                                                var tab = jQuery(tabHTML); 
                                                tab.click(function() {
                                                    layout.activeTabIndex = i;
                                                    $scope.$digest();
                                                });
                                                var title = tab.children('.ng-docker-title');
                                                title.children('.ng-docker-icon').after(jQuery('<div></div>').text(ngDockerUtil.computeLayoutCaption(layout.children[i])).html());
                                                if(tabLayout.split === undefined && tabLayout.icon !== undefined) {
                                                    title.children('.ng-docker-icon').append(icons[tabLayout.id]);
                                                } else {
                                                    title.children('.ng-docker-icon').remove();
                                                }
                                                if(interactive) {
                                                    tab.children('.ng-docker-close').click(function() {
                                                        removeSplitChild(layout, i);
                                                        $scope.$digest();
                                                    });
                                                    dragListeners[dragId++] = {
                                                        element: tab,
                                                        priority: 1,
                                                        threshold: headerDragThreshold,
                                                        dragHandler: function(e) {
                                                            beginFloating(e, layout.children[i]);
                                                        }
                                                    };
                                                }
                                                if(i === layout.activeTabIndex) {
                                                    tab.addClass('ng-docker-tab-active');
                                                }
                                                tab.appendTo(tabNav);
                                            })(i);
                                            if(interactive) {
                                                dragListeners[dragId++] = {
                                                    element: tabNav,
                                                    priority: 0,
                                                    threshold: headerDragThreshold,
                                                    dragHandler: function(e) {
                                                        beginFloating(e, layout);
                                                    }
                                                };
                                            }
                                            var activeChild = layout.children[layout.activeTabIndex];
                                            if(activeChild.split !== undefined) {
                                                construct(layout.children[layout.activeTabIndex], element.children('.ng-docker-contents'), interactive);
                                            } else {
                                                panels[activeChild.id].appendTo(element.children('.ng-docker-contents'));
                                            }
                                        }
                                        break;
                                    default:
                                        validationFail();
                                }
                                element.data('ngDockerLayout', layout);
                                element.appendTo(parent);
                            } else {
                                var panel = panels[layout.id];
                                var panelContainer = jQuery(panelContainerHTML);
                                var header = panelContainer.children('.ng-docker-header');
                                var title = header.children('.ng-docker-title');
                                title.children('.ng-docker-icon').after(jQuery('<div></div>').text(ngDockerUtil.computeLayoutCaption(layout)).html());
                                if(layout.icon !== undefined) {
                                    title.children('.ng-docker-icon').append(icons[layout.id]);
                                } else {
                                    title.children('.ng-docker-icon').remove();
                                }
                                panel.appendTo(panelContainer.children('.ng-docker-contents'));
                                if(interactive) {
                                    dragListeners[dragId++] = {
                                        element: header,
                                        priority: 0,
                                        threshold: headerDragThreshold,
                                        dragHandler: function(e) {
                                            beginFloating(e, layout);
                                        }
                                    };
                                }
                                panelContainer.appendTo(parent);
                            }
                        };
                        // construct all container
                        if(allLayout !== null) {
                            var allContainer = jQuery(allContainerHTML);
                            construct(allLayout, allContainer, true);
                            if(allLayout.split === undefined) {
                                // special case with one root panel
                                allContainer.children().children('.ng-docker-header').children('.ng-docker-close').click(function() {
                                    layoutSet(layoutScope, null);
                                    $scope.$digest();
                                });
                            }
                            allContainer.appendTo($element);
                            updateContainerTabWidths(allContainer);
                        }
                        if(floatingState !== null) {
                            // construct floating container
                            {
                                var floatingContainer = jQuery(floatingContainerHTML)
                                construct(floatingState.layout, floatingContainer, false);
                                floatingContainer.css({
                                    left: floatingState.cursorPosition.pageX + floatingContainerCursorOffset.left - $element.offset().left,
                                    top: floatingState.cursorPosition.pageY + floatingContainerCursorOffset.top - $element.offset().top
                                });
                                floatingContainer.appendTo($element);
                                updateContainerTabWidths(floatingContainer);
                            }
                            // construct drop visuals
                            {
                                var target = computeDropTarget();
                                if(target !== null) {
                                    var element = findDropVisualParentElement(target.layout);
                                    if(element === null) {
                                        throw new Error('Failed to find element for layout', target.layout);
                                    }
                                    var ratioPercStr = floatingState.dropSplitRatio*100 + '%';
                                    var visual;
                                    switch(target.where) {
                                        case 'top':
                                            visual = jQuery(dropVisualTopHTML);
                                            visual.css('height', ratioPercStr);
                                            break;
                                        case 'right':
                                            visual = jQuery(dropVisualRightHTML);
                                            visual.css('width', ratioPercStr);
                                            break;
                                        case 'bottom':
                                            visual = jQuery(dropVisualBottomHTML);
                                            visual.css('height', ratioPercStr);
                                            break;
                                        case 'left':
                                            visual = jQuery(dropVisualLeftHTML);
                                            visual.css('width', ratioPercStr);
                                            break;
                                        case 'whole':
                                            visual = jQuery(dropVisualWholeHTML);
                                            break;
                                        case 'tab':
                                            if(target.layout.split !== undefined) {
                                                if(target.layout.split !== 'tabs') {
                                                    throw new Error('Expected tabs split');
                                                }
                                                var tabNav = findLayoutHeaderElement(target.layout);
                                                var tabVisual = jQuery(dropVisualTabHTML);
                                                if(target.tabIndex === 0) {
                                                    tabNav.prepend(tabVisual)
                                                } else {
                                                    jQuery(tabNav.children('.ng-docker-tab')[target.tabIndex-1]).after(tabVisual);
                                                }
                                                var futureLayout = ngDockerUtil.cloneLayout(target.layout);
                                                futureLayout.children.splice(target.tabIndex, 0, floatingState.layout);
                                                tabNav.children().each(function(index) {
                                                    jQuery(this).css('width', computeTabWidth(futureLayout, tabNav.width(), index));
                                                });
                                                visual = null;
                                            } else {
                                                var header = findLayoutHeaderElement(target.layout);
                                                visual = jQuery(dropVisualTabOnPanelHTML);
                                                var futureLayout = {
                                                    split: 'tabs',
                                                    activeTabIndex: 1,
                                                    children: [
                                                        target.layout,
                                                        floatingState.layout
                                                    ]
                                                };
                                                visual.css({
                                                    left: computeTabWidth(futureLayout, header.width(), 0),
                                                    width: computeTabWidth(futureLayout, header.width(), 1)
                                                });
                                            }
                                            break;
                                        default:
                                            validationFail();
                                    }
                                    if(visual !== null) {
                                        visual.prependTo(element);
                                    }
                                } 
                            }
                        }
                    }
                }).catch(function(e) {
                    templateRequestPack = null;
                    if(!(e instanceof TemplateRequestPack.AbortedException)) {
                        $exceptionHandler(e);
                    }
                });
            };

            // layout watcher
            var flipflop = true;
            var lastLayout = undefined;
            var lastFloatingState = undefined;
            $scope.$watch(function() {
                var layout = layoutGet(layoutScope);
                if(lastLayout !== undefined 
                    && lastFloatingState !== undefined  
                    && (!ngDockerUtil.layoutsEqual(lastLayout, layout)) || !floatingStatesEqual(lastFloatingState, floatingState))
                {
                    flipflop = !flipflop;
                }
                lastLayout = ngDockerUtil.cloneLayout(layout);
                lastFloatingState = cloneFloatingState(floatingState);
                return flipflop;
            }, update);

            jQuery(window).on('resize', update);

            $scope.$on('$destroy', function() {
                jQuery(window).off('resize', update);
            });
        }
    };
}]);
