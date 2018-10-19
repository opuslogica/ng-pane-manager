angular.module('ngDocker', [])
.service('ngDocker', ['ngDockerInternal', function(ngDockerInternal) {
    var that = this;

    // When you add configuration options here, be sure to update ngDockerInternal's cloneConfig and configsEqual
    this.DEFAULT_CONFIG = {
        headerHeight: 20,
        borderWidth: 2,
        marginWidth: 20,
        getterSetter: false,
        closeButton: {
            template: '<span style="position: relative; font-size: 16px;">&#x2A09;</span>'
        },
        refs: {}
    };

    this.ref = function(name) {
        return ngDockerInternal.ref(name);
    };

    this.isRef = function(x) {
        return ngDockerInternal.isRef(x);
    };

    this.deref = function(x, config) {
        return ngDockerInternal.deref(x, config);
    };

    this.findLeaves = function(root) {
        return ngDockerInternal.findLeaves(root);
    };

    this.validateLayout = function(root) {
        return ngDockerInternal.validateLayout(root);
    };

    this.derefLayout = function(root, config) {
        return ngDockerInternal.derefLayout(root, config);
    };

    this.cloneLayout = function(root) {
        return ngDockerInternal.cloneLayout(root);
    };

    this.layoutsEqual = function(a, b) {
        return ngDockerInternal.layoutsEqual(a, b);
    };

    this.derefConfig = function(config) {
        return ngDockerInternal.derefConfig(config);
    };

    this.cloneConfig = function(config) {
        return ngDockerInternal.cloneConfig(config);
    };

    this.configsEqual = function(a, b) {
        return ngDockerInternal.configsEqual(a, b);
    };

    this.findParent = function(root, node) {
        return ngDockerInternal.findParent(root, node);
    };

    this.findLeafWithId = function(root, id) {
        return ngDockerInternal.findLeafWithId(root, id);
    };

    this.removeSplitChild = function(root, node, index) {
        if(node.split === undefined) {
            throw new Error('removeSplitChild only valid on splits');
        }
        node.children.splice(index, 1);
        if(node.split === 'tabs' && node.activeTabIndex >= node.children.length) {
            --node.activeTabIndex;
        }
        if(node.children.length < 2) {
            if(node.children.length === 1) {
                var p = this.findParent(root, node);
                if(p === null) {
                    root = node.children[0];
                } else {
                    p[0].children[p[1]] = node.children[0];
                }
            } else {
                ngDockerInternal.validationFail();
            }
        }
        return root;
    };

    this.removeNode = function(root, node) {
        var p = this.findParent(root, node);
        if(p === null) {
            root = null;
        } else {
            root = this.removeSplitChild(root, p[0], p[1]);
        }
        return root;
    };

    this.removeLeafWithId = function(root, id) {
        var leaves = this.findLeaves(root);
        for(var i = 0; i !== leaves.length; ++i) {
            var leaf = leaves[i];
            if(leaf.id === id) {
                var p = this.findParent(root, leaf);
                if(p === null) {
                    // root panel removed
                    root = null;
                } else {
                    root = this.removeSplitChild(root, p[0], p[1]);
                }
            }
        }
        return root;
    };

    this.revealNode = function(root, node) {
        var p = this.findParent(root, node);
        while(p !== null) {
            if(p[0].split === 'tabs') {
                p[0].activeTabIndex = p[1];
            }
            p = this.findParent(root, p[0]);
        }
    };

    // Leaf must have gravity defined.
    // Leaf may optionally have group defined.
    this.insertLeaf = function(root, leaf, ratio) {
        var that = this;
        if(leaf.gravity === undefined) {
            throw new Error('Layout gravity must be defined');
        }
        var addAsTabSplitTo = function(node) {
            if(node.split === 'tabs') {
                node.children.push(leaf);
                node.activeTabIndex = node.children.length - 1;
            } else {
                var p = that.findParent(root, node);
                if(p !== null && p[0].split === 'tabs') {
                    p[0].children.push(leaf);
                    p[0].activeTabIndex = p[0].children.length-1;
                } else {
                    var tabSplit = {
                        split: 'tabs',
                        activeTabIndex: 1,
                        children: [
                            node,
                            leaf
                        ]
                    };
                    if(p === null) {
                        root = tabSplit;
                    } else {
                        p[0].children[p[1]] = tabSplit;
                    }
                }
            }
        };
        if(root === null) {
            root = leaf;
        } else {
            // try splitting based on group
            if(leaf.group !== undefined) {
                var f = function(node) {
                    if(node.split === undefined) {
                        if(node.group === leaf.group) {
                            addAsTabSplitTo(node);
                            return true;
                        } else {
                            return false;
                        }
                    } else {
                        for(var i = 0; i !== node.children.length; ++i) {
                            if(f(node.children[i])) {
                                return true;
                            }
                        }
                        return false;
                    }
                };
                if(f(root)) {
                    return root;
                }
            }
            // split based on gravity
            var r = ngDockerInternal.matchLayoutPattern(root);
            var gravity = ngDockerInternal.computeLayoutGravity(leaf);
            var f = function(m, node) {
                if(m === gravity) {
                    addAsTabSplitTo(node);
                    return true;
                } else if(typeof m === 'object' && m.split !== undefined) {
                    for(var i = 0; i !== m.children.length; ++i) {
                        if(f(m.children[i], node.children[i])) {
                            return true;
                        }
                    }
                    return false;
                } else {
                    return false;
                }
            };
            if(!f(r.match, r.node)) {
                var insertStrategy = ngDockerInternal.findInsertStrategy(r.match, leaf);
                var ratio = ngDockerInternal.computeInsertRatio(root, insertStrategy, r.node, ratio);
                var layoutToSplit = insertStrategy.node(r.node);
                var p = this.findParent(root, layoutToSplit);
                var split = {
                    split: insertStrategy.split,
                    ratio: ratio,
                    children: insertStrategy.index === 0 ? [
                        leaf,
                        layoutToSplit
                    ] : [
                        layoutToSplit,
                        leaf
                    ]
                };
                if(p === null) {
                    root = split;
                } else {
                    p[0].children[p[1]] = split;
                }
            }
        }
        return root;
    };
}])
.directive('ngDocker', ['$parse', '$compile', '$templateCache', '$templateRequest', '$q', '$exceptionHandler', '$controller', '$injector', 'ngDocker', 'ngDockerInternal', function($parse, $compile, $templateCache, $templateRequest, $q, $exceptionHandler, $controller, $injector, ngDocker, ngDockerInternal) {
    return {
        restrict: 'E',
        scope: true,
        link: function($scope, $element, $attr) {
            var tabNavRightPadding = 20; // given a full tab nav bar, how much space to leave at the right to allow the user to drag it
            var headerDragThreshold = 5;
            var floatingContainerCursorOffset = {
                left: -10,
                top: -10
            };
            var initialTabWidth = 200;
            var defaultDropSplitRatio = 0.3333333;
            var allContainerHTML =
                '<div class="ng-docker-container"></div>';
            var floatingContainerHTML =
                '<div class="ng-docker-floating-container"></div>';
            var panelContainerHTML =
                '<div class="ng-docker-panel-container">' +
                '   <div class="ng-docker-header">' +
                '       <div class="ng-docker-title">' +
                '           <div class="ng-docker-icon"></div>' +
                '           <div class="ng-docker-title-text"></div>' +
                '       </div>' +
                '       <div class="ng-docker-close"></div>' +
                '   </div>' +
                '   <div class="ng-docker-contents"></div>' +
                '</div>';
            var vsplitHTML =
                '<div class="ng-docker-vsplit">' +
                '   <div class="ng-docker-left"></div>' +
                '   <div class="ng-docker-separator ng-docker-border ng-docker-vertical-border"></div>' +
                '   <div class="ng-docker-right"></div>' +
                '</div>';
            var hsplitHTML =
                '<div class="ng-docker-hsplit">' +
                '   <div class="ng-docker-top"></div>' +
                '   <div class="ng-docker-separator ng-docker-border-invisible ng-docker-horizontal-border"></div>' +
                '   <div class="ng-docker-bottom"></div>' +
                '</div>';
            var tabsplitHTML =
                '<div class="ng-docker-tabsplit">' +
                '   <div class="ng-docker-tab-nav">' +
                '   </div>' +
                '   <div class="ng-docker-contents"></div>' +
                '</div>';
            var tabNavBorderHTML = '<div class="ng-docker-border ng-docker-tab-nav-border"></div>';
            var tabHTML =
                '<div class="ng-docker-tab">' +
                '   <div class="ng-docker-title">' +
                '       <div class="ng-docker-icon"></div>' +
                '       <div class="ng-docker-title-text"></div>' +
                '   </div>' +
                '   <div class="ng-docker-close"></div>' +
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
            var templateResolver = null;
            var floatingState = null;
            var dragListeners = {};

            var TemplateResolver = function(config) {
                this._config = config;
                this._promises = [];
                this._aborted = false;
            };

            TemplateResolver.AbortedException = function() {};

            TemplateResolver.prototype.add = function(template) {
                if(this._aborted) {
                    throw new Error('Cannot add templates to an aborted TemplateResolver');
                }
                if(template.templateUrl !== undefined) {
                    this._promises.push($templateRequest(template.templateUrl));
                }
                if(template.resolve !== undefined) {
                    var that = this;
                    template._resolved = {};
                    Object.keys(template.resolve).forEach(function(k) {
                        var val = ngDocker.deref(template.resolve[k], that._config);
                        if(typeof val === 'string') {
                            template._resolved[k] = $injector.get(k);
                        } else {
                            that._promises.push($q.when($injector.invoke(val, null, null, k)).then(function(res) {
                                if(that._aborted) {
                                    return;
                                }
                                template._resolved[k] = res;
                            }));
                        }
                    });
                }
            };

            TemplateResolver.prototype.finalize = function() {
                var that = this;
                return $q.all(this._promises).then(function() {
                    if(that._aborted) {
                        throw new TemplateResolver.AbortedException();
                    }
                });
            };

            TemplateResolver.prototype.abort = function() {
                this._aborted = true;
            };

            var validationFail = function() {
                ngDockerInternal.validationFail();
            };

            var cloneFloatingState = function(floatingState) {
                if(floatingState === null) {
                    return null;
                } else {
                    return {
                        layout: ngDocker.cloneLayout(floatingState.layout),
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
                    if(!ngDocker.layoutsEqual(a.layout, b.layout)) {
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

            var configGet;
            if($attr.config !== undefined) {
                var configGetRaw = $parse($attr.config);
                configGet = function(obj) {
                    return angular.extend({}, ngDocker.DEFAULT_CONFIG, configGetRaw(obj));
                };
            } else {
                configGet = function(obj) {
                    return ngDocker.DEFAULT_CONFIG;
                };
            }

            var layoutGet;
            var layoutSet;
            if(configGet($scope).getterSetter) {
                var layoutGetRaw = $parse($attr.layout);
                layoutGet = function(obj) {
                    return layoutGetRaw(obj)();
                };
                layoutSet = function(obj, val) {
                    layoutGetRaw(obj)(val);
                };
            } else {
                var layoutGetRaw = $parse($attr.layout);
                layoutGet = function(obj) {
                    // convert falsy layouts to null
                    var result = layoutGetRaw(obj);
                    return result ? result : null;
                };
                layoutSet = layoutGetRaw.assign;
                if(!layoutSet) {
                    throw new Error('layout must be assignable');
                }
            }

            var findParent = function(node) {
                var p = ngDocker.findParent(layoutGet($scope), node);
                if(p === undefined) {
                    throw new Error('Failed to find node');
                } else {
                    return p;
                }
            };

            // returns the DOM element whose ngDockerNode == layout, or null if no such element exists
            var findElementWithNode = function(node) {
                var f = function(element) {
                    var elementNode = element.data('ngDockerNode');
                    if(elementNode !== undefined && ngDocker.layoutsEqual(elementNode, node)) {
                        return element;
                    } else {
                        var children = element.children();
                        for(var i = 0; i !== children.length; ++i) {
                            var result = f(angular.element(children[i]));
                            if(result !== null) {
                                return result;
                            }
                        }
                        return null;
                    }
                };
                return f(ngDockerInternal.childrenWithClass($element, 'ng-docker-container'));
            };

            // returns the DOM element where the drop visual should be inserted into as a child
            var findDropVisualParentElement = function(node) {
                if(node === null) {
                    return $element;
                } else if(node.split !== undefined) {
                    return findElementWithNode(node);
                } else {
                    var panel = panels[node.id];
                    if(panel !== undefined && panel.parent().length > 0) {
                        var p = findParent(node);
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

            var findNodeHeaderElement = function(node) {
                if(node.split !== undefined) {
                    switch(node.split) {
                        case 'vertical':
                        case 'horizontal':
                            // vertical/horizontal splits do not have a header
                            return null;
                        case 'tabs':
                            {
                                var element = findElementWithNode(node);
                                if(element !== null) {
                                    return ngDockerInternal.childrenWithClass(element, 'ng-docker-tab-nav');
                                } else {
                                    return null;
                                }
                            }
                            break;
                        default:
                            ngDockerInternal.validationFail();
                    }
                } else {
                    var panel = panels[node.id];
                    if(panel !== undefined && panel.parent().length > 0) {
                        var p = findParent(node);
                        if(p === null || p[0].split !== 'tabs') {
                            // panel is wrapped in panelContainerHTML, provide .ng-docker-header
                            return ngDockerInternal.childrenWithClass(panel.parent().parent(), 'ng-docker-header');
                        } else {
                            // panel is wrapped inside a tabsplitHTML, it does not have its own header
                            return null;
                        }
                    } else {
                        return null;
                    }
                }
            };

            var replaceNode = function(node, replacement) {
                var p = findParent(node);
                if(p === null) {
                    layoutSet($scope, replacement);
                } else {
                    p[0].children[p[1]] = replacement;
                    layoutSet($scope, layoutGet($scope));
                }
            };

            var removeSplitChild = function(node, index) {
                layoutSet($scope, ngDocker.removeSplitChild(layoutGet($scope), node, index));
            };

            var removeLeafWithId = function(id) {
                layoutSet($scope, ngDocker.removeLeafWithId(layoutGet($scope), id));
            };

            var removeNode = function(node) {
                layoutSet($scope, ngDocker.removeNode(layoutGet($scope), node));
            };

            // get the angular template string from a template
            var getTemplateTemplateString = function(template) {
                return template.templateUrl ? $templateCache.get(template.templateUrl) : template.template;
            }

            var newTemplateScope = function(template) {
                var scope = $scope.$new();
                if(template.scope !== undefined) {
                    var config = configGet($scope);
                    Object.keys(template.scope).forEach(function(k) {
                        scope[k] = ngDocker.deref(template.scope[k], config);
                    });
                }
                return scope;
            };

            var maybeLoadTemplateController = function(template, scope, element) {
                if(template.controller !== undefined) {
                    var config = configGet($scope);
                    var locals = {
                        $scope: scope,
                        $element: element
                    };
                    if(template.resolve !== undefined) {
                        Object.keys(template.resolve).forEach(function(k) {
                            locals[k] = template._resolved[k];
                        });
                        delete template._resolved;
                    }
                    var controller = ngDocker.deref(template.controller, config);
                    element.data('$ngDockerPanelController', $controller(controller, locals));
                }
            };

            var computeDropSplitWhere = function(element) {
                var offs = ngDockerInternal.elementOffset(element);
                var x = floatingState.cursorPosition.pageX - offs.left;
                var y = floatingState.cursorPosition.pageY - offs.top;
                var w = ngDockerInternal.elementWidth(element);
                var h = ngDockerInternal.elementHeight(element);
                var y1 = h/w*x;
                var y2 = -h/w*x + h;
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
                var root = layoutGet($scope);
                if(root === null) {
                    // drop as root
                    return {
                        where: 'whole',
                        node: null
                    };
                } else {
                    // check panels (for vertical/horizontal split)
                    {
                        var panelIds = ngDocker.findLeaves(root).map(function(l) {
                            return l.id;
                        });
                        for(var i = 0; i !== panelIds.length; ++i) {
                            var panel = panels[panelIds[i]];
                            var container = panel.parent();
                            if(container.length > 0) {
                                var containerOffs = ngDockerInternal.elementOffset(container);
                                if(floatingState.cursorPosition.pageX >= containerOffs.left && floatingState.cursorPosition.pageX < containerOffs.left + ngDockerInternal.elementWidth(container)
                                    && floatingState.cursorPosition.pageY >= containerOffs.top && floatingState.cursorPosition.pageY < containerOffs.top + ngDockerInternal.elementHeight(container))
                                {
                                    return {
                                        where: computeDropSplitWhere(container),
                                        node: panel.data('ngDockerNode')
                                    };
                                }
                            }
                        }
                    }
                    // check headers (for tabs split)
                    {
                        var f = function(node) {
                            var header = findNodeHeaderElement(node);
                            if(header !== null) {
                                if(node.split === 'tabs') {
                                    var headerOffs = ngDockerInternal.elementOffset(header);
                                    if(floatingState.cursorPosition.pageX >= headerOffs.left && floatingState.cursorPosition.pageX < headerOffs.left + ngDockerInternal.elementWidth(header)
                                        && floatingState.cursorPosition.pageY >= headerOffs.top && floatingState.cursorPosition.pageY < headerOffs.top + ngDockerInternal.elementHeight(header))
                                    {
                                        var tabs = ngDockerInternal.childrenWithClass(header, 'ng-docker-tab'); 
                                        for(var i = 0; i !== tabs.length; ++i) {
                                            var tab = angular.element(tabs[i]);
                                            var tabOffs = ngDockerInternal.elementOffset(tab);
                                            if(floatingState.cursorPosition.pageX >= tabOffs.left && floatingState.cursorPosition.pageX < tabOffs.left + ngDockerInternal.elementWidth(tab)
                                                && floatingState.cursorPosition.pageY >= tabOffs.top && floatingState.cursorPosition.pageY < tabOffs.top + ngDockerInternal.elementHeight(tab))
                                            {
                                                var tabIndex;
                                                if(floatingState.cursorPosition.pageX < tabOffs.left + ngDockerInternal.elementWidth(tab)/2) {
                                                    tabIndex = i;
                                                } else {
                                                    tabIndex = i+1;
                                                }
                                                return {
                                                    where: 'tab',
                                                    tabIndex: tabIndex,
                                                    node: node
                                                };
                                            }
                                        }
                                        return {
                                            where: 'tab',
                                            tabIndex: node.children.length,
                                            node: node
                                        };
                                    }
                                } else {
                                    if(node.split !== undefined) {
                                        throw new Error('Unexpected header on a ' + node.split + ' split');
                                    }
                                    var headerOffs = ngDockerInternal.elementOffset(header);
                                    if(floatingState.cursorPosition.pageX >= headerOffs.left && floatingState.cursorPosition.pageX < headerOffs.left + ngDockerInternal.elementWidth(header)
                                        && floatingState.cursorPosition.pageY >= headerOffs.top && floatingState.cursorPosition.pageY < headerOffs.top + ngDockerInternal.elementHeight(header))
                                    {
                                        return {
                                            where: 'tab',
                                            tabIndex: 1,
                                            node: node
                                        };
                                    }
                                }
                            }
                            if(node.split !== undefined) {
                                for(var i = 0; i !== node.children.length; ++i) {
                                    var result = f(node.children[i]);
                                    if(result !== null) {
                                        return result;
                                    }
                                }
                            }
                            return null;
                        };
                        var result = f(root);
                        if(result !== null) {
                            return result;
                        }
                    }
                    // assume root (for vertical/horizontal split at root)
                    {
                        return {
                            where: computeDropSplitWhere($element),
                            node: root
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
                        replaceNode(target.node, {
                            split: 'horizontal',
                            ratio: floatingState.dropSplitRatio,
                            children: [
                                floatingState.layout,
                                target.node
                            ]
                        });
                        break;
                    case 'right':
                        replaceNode(target.node, {
                            split: 'vertical',
                            ratio: 1-floatingState.dropSplitRatio,
                            children: [
                                target.node,
                                floatingState.layout
                            ]
                        });
                        break;
                    case 'bottom':
                        replaceNode(target.node, {
                            split: 'horizontal',
                            ratio: 1-floatingState.dropSplitRatio,
                            children: [
                                target.node,
                                floatingState.layout
                            ]
                        });
                        break;
                    case 'left':
                        replaceNode(target.node, {
                            split: 'vertical',
                            ratio: floatingState.dropSplitRatio,
                            children: [
                                floatingState.layout,
                                target.node
                            ]
                        });
                        break;
                    case 'whole':
                        if(target.node !== null) {
                            throw new Error('layout must be null when where is whole');
                        }
                        layoutSet($scope, floatingState.layout);
                        break;
                    case 'tab':
                        if(target.node.split !== undefined) {
                            if(target.node.split !== 'tabs') {
                                throw new Error('Expected tabs split');
                            }
                            target.node.children.splice(target.tabIndex, 0, floatingState.layout);
                            target.node.activeTabIndex = target.tabIndex;
                        } else {
                            replaceNode(target.node, {
                                split: 'tabs',
                                activeTabIndex: 1,
                                children: [
                                    target.node,
                                    floatingState.layout
                                ]
                            });
                        }
                        break;
                    default:
                        throw new Error('Unrecognized where \'' + target.where + '\'');
                }
            };

            var computeTabWidth = function(node, headerWidth, tabIndex) {
                if(node.split !== 'tabs') {
                    throw new Error('computeTabWidth expects node to be a tabs split');
                }
                var w = headerWidth - tabNavRightPadding;
                if(node.children.length*initialTabWidth < w) {
                    return initialTabWidth;
                } else {
                    return w/node.children.length;
                }
            };

            var updateContainerTabWidths = function(container) {
                if(container.length === 0) {
                    return;
                }
                var tabsplits = angular.element(container[0].querySelectorAll('.ng-docker-tabsplit'));
                for(var i = 0; i !== tabsplits.length; ++i) {
                    var tabsplit = angular.element(tabsplits[i]);
                    var tabNav = ngDockerInternal.childrenWithClass(tabsplit, 'ng-docker-tab-nav');
                    var node = tabsplit.data('ngDockerNode');
                    var tabs = ngDockerInternal.childrenWithClass(tabNav, 'ng-docker-tab'); 
                    for(var i = 0; i !== tabs.length; ++i) {
                        var tab = angular.element(tabs[i]);
                        tab.css('width', computeTabWidth(node, ngDockerInternal.elementWidth(tabNav), i) + 'px');
                    }
                }
            };

            var clearDropTargetVisuals = function() {
                angular.element($element[0].querySelectorAll('.ng-docker-drop-visual')).remove();
                updateContainerTabWidths(angular.element($element[0].querySelectorAll('.ng-docker-container')));
                updateContainerTabWidths(angular.element($element[0].querySelectorAll('.ng-docker-floating-container')));
            };

            var beginFloating = function(info, node) {
                if(floatingState !== null) {
                    throw new Error('Cannot construct floating state while one is already present');
                }
                var p = findParent(node);
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
                        ngDockerInternal.validationFail();
                }
                removeNode(node);
                floatingState = {
                    layout: node,
                    dropSplitRatio: dropSplitRatio,
                    cursorPosition: {
                        pageX: info.pageX,
                        pageY: info.pageY
                    }
                };
            };

            // mouse event handlers
            {
                var activeDragId = null;
                var activeDragStartPos = null;
                var release = function(info) {
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
                        activeDragId = null;
                    }
                };
                var move = function(info) {
                    if(floatingState !== null) {
                        activeDragId = null;
                        floatingState.cursorPosition = {
                            pageX: info.pageX,
                            pageY: info.pageY
                        };
                        $scope.$digest();
                        return true;
                    } else if(activeDragId !== null) {
                        var dl = dragListeners[activeDragId];
                        if(dl === undefined) {
                            activeDragId = null;
                        } else {
                            var dist = Math.sqrt((info.pageX-activeDragStartPos.pageX)*(info.pageX-activeDragStartPos.pageX) + (info.pageY-activeDragStartPos.pageY)*(info.pageY-activeDragStartPos.pageY));
                            if(dl.threshold === undefined || dist >= dl.threshold) {
                                if(dl.dragHandler) {
                                    dl.dragHandler(info);
                                    $scope.$digest();
                                }
                            }
                            return true;
                        }
                    }
                    return false;
                };
                var down = function(info) {
                    activeDragId = null;
                    var keys = Object.keys(dragListeners);
                    var candidates = [];
                    for(var i = 0; i !== keys.length; ++i) {
                        var dl = dragListeners[keys[i]];
                        var el = dl.element;
                        var elOffs = ngDockerInternal.elementOffset(el);
                        if(info.pageX >= elOffs.left && info.pageY >= elOffs.top
                            && info.pageX < elOffs.left + ngDockerInternal.elementWidth(el) && info.pageY < elOffs.top + ngDockerInternal.elementHeight(el))
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
                            pageX: info.pageX,
                            pageY: info.pageY
                        };
                        if(dl.downHandler) {
                            dl.downHandler(info);
                            $scope.$digest();
                        }
                        return true;
                    }
                    return false;
                };
                $element[0].addEventListener('mouseup', function(e) {
                    var info = {pageX: e.pageX, pageY: e.pageY};
                    if(e.button === 0) {
                        release(info);
                    }
                });
                $element[0].addEventListener('mouseleave', function(e) {
                    var info = {pageX: e.pageX, pageY: e.pageY};
                    if(e.button === 0) {
                        release(info);
                    }
                });
                $element[0].addEventListener('mousemove', function(e) {
                    var info = {pageX: e.pageX, pageY: e.pageY};
                    if(e.buttons === 1) {
                        if(move(info)) {
                            e.preventDefault();
                        }
                    } else {
                        release(info);
                    }
                });
                $element[0].addEventListener('mousedown', function(e) {
                    var info = {pageX: e.pageX, pageY: e.pageY};
                    if(e.button === 0) {
                        if(down(info)) {
                            e.preventDefault();
                        }
                    }
                });
            }

            var update = function() {
                if(templateResolver !== null) {
                    templateResolver.abort();
                    templateResolver = null;
                }

                var layout = layoutGet($scope);
                var config = configGet($scope);
                var configCopy = ngDocker.cloneConfig(config);

                var leaves =  [];
                if(layout !== null) {
                    ngDocker.validateLayout(layout);
                    Array.prototype.push.apply(leaves, ngDocker.findLeaves(layout));
                }
                if(floatingState !== null) {
                    ngDocker.validateLayout(floatingState.layout);
                    Array.prototype.push.apply(leaves, ngDocker.findLeaves(floatingState.layout));
                }

                // load any uncached templates before proceeding
                templateResolver = new TemplateResolver(config);
                templateResolver.add(config.closeButton);
                leaves.forEach(function(leaf) {
                    if(leaf.icon !== undefined) {
                        templateResolver.add(leaf.icon);
                    }
                    templateResolver.add(leaf.panel);
                });
                templateResolver.finalize().then(function() {
                    templateResolver = null;
                    // try to adapt any previously constructed icons and panels to the new leaves, discard those that cannot be adapted
                    {
                        var tryAdapt = function(m, leavesById) {
                            var next = {};
                            Object.keys(m).forEach(function(k) {
                                var el = m[k];
                                var elNode = el.data('ngDockerNode');
                                var elConfig = el.data('ngDockerConfig');
                                var leaf = leavesById[elNode.id];
                                var destroy = false;
                                if(!leaf) {
                                    destroy = true;
                                } else {
                                    var before = ngDocker.derefLayout(ngDocker.cloneLayout(elNode), elConfig);
                                    var after = ngDocker.derefLayout(ngDocker.cloneLayout(leaf), config);
                                    if(!ngDocker.layoutsEqual(before, after)) {
                                        destroy = true;
                                    }
                                }
                                if(destroy) {
                                    el.scope().$destroy();
                                    el.remove();
                                } else {
                                    el.detach();
                                    next[leaf.id] = el;
                                }
                            });
                            return next;
                        };
                        var leavesById = {};
                        var leavesWithIconById = {};
                        leaves.forEach(function(leaf) {
                            leavesById[leaf.id] = leaf;
                            if(leaf.icon !== undefined) {
                                leavesWithIconById[leaf.id] = leaf;
                            }
                        });
                        icons = tryAdapt(icons, leavesWithIconById);
                        panels = tryAdapt(panels, leavesById);
                    }

                    // construct any missing icons and panels
                    leaves.forEach(function(leaf) {
                        if(!panels[leaf.id]) {
                            var panelScope = newTemplateScope(leaf.panel);
                            panelScope.closeThisPanel = function() {
                                removeLeafWithId(leaf.id);
                            };
                            var panel = $compile(getTemplateTemplateString(leaf.panel))(panelScope);
                            maybeLoadTemplateController(leaf.panel, panelScope, panel);
                            panel.data('ngDockerNode', ngDocker.cloneLayout(leaf));
                            panel.data('ngDockerConfig', configCopy);
                            panels[leaf.id] = panel;
                        }
                        if(leaf.icon !== undefined && !icons[leaf.id]) {
                            var iconScope = newTemplateScope(leaf.icon);
                            var icon = $compile(getTemplateTemplateString(leaf.icon))(iconScope);
                            icon.data('ngDockerNode', ngDocker.cloneLayout(leaf));
                            icon.data('ngDockerConfig', configCopy);
                            maybeLoadTemplateController(leaf.icon, iconScope, icon);
                            icons[leaf.id] = icon;
                        }
                    });

                    // clear drag listeners
                    dragListeners = {};

                    // clear the constructed DOM
                    ngDockerInternal.childrenWithClass($element, 'ng-docker-container').remove();
                    ngDockerInternal.childrenWithClass($element, 'ng-docker-floating-container').remove();
                    ngDockerInternal.childrenWithClass($element, 'ng-docker-drop-visual').remove();

                    // construct the new DOM
                    {
                        var dragId = 0;
                        var initCloseButton = function(closeElem) {
                            var scope = newTemplateScope(config.closeButton);
                            closeElem.append($compile(getTemplateTemplateString(config.closeButton))(scope));
                        };
                        var construct = function(root, node, container, interactive) {
                            if(node.split !== undefined) {
                                var element;
                                switch(node.split) {
                                    case 'vertical':
                                        {
                                            element = angular.element(vsplitHTML);
                                            var needsLeftBorder = (function() {
                                                // if none of this vsplit's ancestors are the second child of a vsplit this vsplit needs a left border
                                                for(var p = ngDocker.findParent(root, node); p !== null; p = ngDocker.findParent(root, p[0])) {
                                                    if(p[0].split === 'vertical' && p[1] === 1) {
                                                        return false;
                                                    }
                                                }
                                                return true;
                                            });
                                            var needsRightBorder = (function() {
                                                // if none of this vsplit's ancestors are the first child of a vsplit this vsplit needs a right border
                                                for(var p = ngDocker.findParent(root, node); p !== null; p = ngDocker.findParent(root, p[0])) {
                                                    if(p[0].split === 'vertical' && p[1] === 0) {
                                                        return false;
                                                    }
                                                }
                                                return true;
                                            });
                                            if(needsLeftBorder()) {
                                                var borderLeft = angular.element('<div class="ng-docker-border ng-docker-vertical-border"></div>');
                                                borderLeft.css('top', config.headerHeight + 'px');
                                                borderLeft.css('width', config.borderWidth + 'px');
                                                borderLeft.css('left', '0');
                                                element.prepend(borderLeft);
                                            }
                                            if(needsRightBorder()) {
                                                var borderRight = angular.element('<div class="ng-docker-border ng-docker-vertical-border"></div>');
                                                borderRight.css('top', config.headerHeight + 'px');
                                                borderRight.css('width', config.borderWidth + 'px');
                                                borderRight.css('right', '0');
                                                element.append(borderRight);
                                            }
                                            window.childrenWithClass = ngDockerInternal.childrenWithClass;
                                            var left = ngDockerInternal.childrenWithClass(element, 'ng-docker-left');
                                            var sep = ngDockerInternal.childrenWithClass(element, 'ng-docker-separator');
                                            var right = ngDockerInternal.childrenWithClass(element, 'ng-docker-right');
                                            sep.css('top', config.headerHeight + 'px');
                                            construct(root, node.children[0], left, interactive);
                                            construct(root, node.children[1], right, interactive);
                                            left.css('width', 100*node.ratio + '%');
                                            sep.css('left', 'calc(' + 100*node.ratio + '% - ' + config.borderWidth/2 + 'px)');
                                            sep.css('width', config.borderWidth + 'px');
                                            right.css('width', 100*(1 - node.ratio) + '%');
                                            if(interactive) {
                                                ngDockerInternal.childrenWithClass(ngDockerInternal.childrenWithClass(left.children(), 'ng-docker-header'), 'ng-docker-close').on('click', function() {
                                                    removeSplitChild(node, 0);
                                                    $scope.$digest();
                                                });
                                                ngDockerInternal.childrenWithClass(ngDockerInternal.childrenWithClass(right.children(), 'ng-docker-header'), 'ng-docker-close').on('click', function() {
                                                    removeSplitChild(node, 1);
                                                    $scope.$digest();
                                                });
                                                dragListeners[dragId++] = {
                                                    element: sep,
                                                    priority: 1,
                                                    dragHandler: function(info) {
                                                        var elOffs = ngDockerInternal.elementOffset(element);
                                                        node.ratio = Math.max(0, Math.min(1, (info.pageX - elOffs.left)/ngDockerInternal.elementWidth(element)));
                                                        layoutSet($scope, layoutGet($scope));
                                                    }
                                                };
                                            }
                                        }
                                        break;
                                    case 'horizontal':
                                        {
                                            element = angular.element(hsplitHTML);
                                            var needsBottomBorder = (function() {
                                                // if none of this hsplits's ancestors are the first child of an hsplit this hsplit needs a bottom border
                                                for(var p = ngDocker.findParent(root, node); p !== null; p = ngDocker.findParent(root, p[0])) {
                                                    if(p[0].split === 'horizontal' && p[1] === 0) {
                                                        return false;
                                                    }
                                                }
                                                return true;
                                            });
                                            if(needsBottomBorder()) {
                                                var borderBottom = angular.element('<div class="ng-docker-border ng-docker-horizontal-border"></div>');
                                                borderBottom.css('height', config.borderWidth + 'px');
                                                borderBottom.css('bottom', '0');
                                                element.append(borderBottom);
                                            }
                                            var top = ngDockerInternal.childrenWithClass(element, 'ng-docker-top'); 
                                            var sep = ngDockerInternal.childrenWithClass(element, 'ng-docker-separator'); 
                                            var bottom = ngDockerInternal.childrenWithClass(element, 'ng-docker-bottom');
                                            construct(root, node.children[0], top, interactive);
                                            construct(root, node.children[1], bottom, interactive);
                                            top.css('height', 100*node.ratio + '%');
                                            sep.css('top', 'calc(' + 100*node.ratio + '% - ' + config.borderWidth/2 + 'px)');
                                            sep.css('height', config.borderWidth + 'px');
                                            bottom.css('height', 100*(1-node.ratio) + '%');
                                            if(interactive) {
                                                ngDockerInternal.childrenWithClass(ngDockerInternal.childrenWithClass(top.children(), 'ng-docker-header'), 'ng-docker-close').on('click', function() {
                                                    removeSplitChild(node, 0);
                                                    $scope.$digest();
                                                });
                                                ngDockerInternal.childrenWithClass(ngDockerInternal.childrenWithClass(bottom.children(), 'ng-docker-header'), 'ng-docker-close').on('click', function() {
                                                    removeSplitChild(node, 1);
                                                    $scope.$digest();
                                                });
                                                dragListeners[dragId++] = {
                                                    element: sep,
                                                    priority: 2,
                                                    dragHandler: function(info) {
                                                        var elOffs = ngDockerInternal.elementOffset(element);
                                                        node.ratio = Math.max(0, Math.min(1, (info.pageY - elOffs.top)/ngDockerInternal.elementHeight(element)));
                                                        layoutSet($scope, layoutGet($scope));
                                                    }
                                                };
                                            }
                                        }
                                        break;
                                    case 'tabs':
                                        {
                                            element = angular.element(tabsplitHTML);
                                            var tabNav = ngDockerInternal.childrenWithClass(element, 'ng-docker-tab-nav');
                                            var borderLeft = angular.element(tabNavBorderHTML);
                                            var borderRight = angular.element(tabNavBorderHTML);
                                            [borderLeft, borderRight].forEach(function(el) {
                                                el.css('width', config.borderWidth + 'px');
                                                el.css('height', config.headerHeight + 'px');
                                            });
                                            borderLeft.css('left', '0');
                                            borderRight.css('right', '0');
                                            tabNav.append(borderLeft);
                                            tabNav.append(borderRight);
                                            tabNav.css('height', config.headerHeight + 'px');
                                            for(var i = 0; i !== node.children.length; ++i) (function(i) {
                                                var tabNode = node.children[i];
                                                // note: the width for this tab is calculated after the entire DOM is built: see updateContainerTabWidths
                                                var tab = angular.element(tabHTML);
                                                tab.on('click', function() {
                                                    node.activeTabIndex = i;
                                                    $scope.$digest();
                                                });
                                                var title = ngDockerInternal.childrenWithClass(tab, 'ng-docker-title');
                                                if(tabNode.closeable === undefined || tabNode.closeable) {
                                                    initCloseButton(ngDockerInternal.childrenWithClass(tab, 'ng-docker-close'));
                                                } else {
                                                    ngDockerInternal.childrenWithClass(tab, 'ng-docker-close').remove();
                                                }
                                                ngDockerInternal.childrenWithClass(title, 'ng-docker-title-text').text(ngDockerInternal.computeLayoutTitle(tabNode));
                                                if(tabNode.split === undefined && tabNode.icon !== undefined) {
                                                    ngDockerInternal.childrenWithClass(title, 'ng-docker-icon').append(icons[tabNode.id]);
                                                } else {
                                                    ngDockerInternal.childrenWithClass(title, 'ng-docker-icon').remove();
                                                }
                                                if(interactive) {
                                                    ngDockerInternal.childrenWithClass(tab, 'ng-docker-close').on('click', function() {
                                                        removeSplitChild(node, i);
                                                        $scope.$digest();
                                                    });
                                                    dragListeners[dragId++] = {
                                                        element: tab,
                                                        priority: 1,
                                                        threshold: headerDragThreshold,
                                                        dragHandler: function(info) {
                                                            beginFloating(info, node.children[i]);
                                                        }
                                                    };
                                                }
                                                if(i === node.activeTabIndex) {
                                                    tab.addClass('ng-docker-tab-active');
                                                }
                                                tabNav.append(tab);
                                            })(i);
                                            var needsSideBorders = function() {
                                                for(var p = ngDocker.findParent(root, node); p !== null; p = ngDocker.findParent(root, p[0])) {
                                                    if(p[0].split === 'vertical') {
                                                        return false;
                                                    }
                                                }
                                                return true;
                                            };
                                            var needsBottomBorder = function() {
                                                for(var p = ngDocker.findParent(root, node); p !== null; p = ngDocker.findParent(root, p[0])) {
                                                    if(p[0].split === 'horizontal') {
                                                        return false;
                                                    }
                                                }
                                                return true;
                                            };
                                            if(needsSideBorders()) {
                                                var borderLeft = angular.element('<div class="ng-docker-border ng-docker-vertical-border"></div>');
                                                var borderRight = angular.element('<div class="ng-docker-border ng-docker-vertical-border"></div>');
                                                borderLeft.css('top', config.headerHeight + 'px');
                                                borderLeft.css('width', config.borderWidth + 'px');
                                                borderLeft.css('left', '0');
                                                borderRight.css('top', config.headerHeight + 'px');
                                                borderRight.css('width', config.borderWidth + 'px');
                                                borderRight.css('right', '0');
                                                element.append(borderLeft);
                                                element.append(borderRight);
                                            }
                                            if(needsBottomBorder()) {
                                                var borderBottom = angular.element('<div class="ng-docker-border ng-docker-horizontal-border"></div>');
                                                borderBottom.css('height', config.borderWidth + 'px');
                                                borderBottom.css('bottom', '0');
                                                element.append(borderBottom);
                                            }
                                            if(interactive) {
                                                dragListeners[dragId++] = {
                                                    element: tabNav,
                                                    priority: 0,
                                                    threshold: headerDragThreshold,
                                                    dragHandler: function(e) {
                                                        beginFloating(e, node);
                                                    }
                                                };
                                            }
                                            var activeChild = node.children[node.activeTabIndex];
                                            var contents = ngDockerInternal.childrenWithClass(element, 'ng-docker-contents');
                                            contents.css('top', config.headerHeight + 'px');
                                            if(activeChild.split !== undefined) {
                                                construct(root, node.children[node.activeTabIndex], contents, interactive);
                                            } else {
                                                contents.append(panels[activeChild.id]);
                                            }
                                        }
                                        break;
                                    default:
                                        ngDockerInternal.validationFail();
                                }
                                element.data('ngDockerNode', ngDocker.cloneLayout(node));
                                element.data('ngDockerConfig', configCopy);
                                container.append(element);
                            } else {
                                var panel = panels[node.id];
                                var panelContainer = angular.element(panelContainerHTML);
                                var header = ngDockerInternal.childrenWithClass(panelContainer, 'ng-docker-header');
                                var contents = ngDockerInternal.childrenWithClass(panelContainer, 'ng-docker-contents');
                                var title = ngDockerInternal.childrenWithClass(header, 'ng-docker-title'); 
                                if(node.closeable === undefined || node.closeable) {
                                    initCloseButton(ngDockerInternal.childrenWithClass(header, 'ng-docker-close'));
                                } else {
                                    ngDockerInternal.childrenWithClass(header, 'ng-docker-close').remove();
                                }
                                header.css('height', config.headerHeight + 'px');
                                contents.css('top', config.headerHeight + 'px');
                                ngDockerInternal.childrenWithClass(title, 'ng-docker-title-text').text(ngDockerInternal.computeLayoutTitle(node));
                                if(node.icon !== undefined) {
                                    ngDockerInternal.childrenWithClass(title, 'ng-docker-icon').append(icons[node.id]);
                                } else {
                                    ngDockerInternal.childrenWithClass(title, 'ng-docker-icon').remove();
                                }
                                contents.append(panel);
                                var needsSideBorders = function() {
                                    for(var p = ngDocker.findParent(root, node); p !== null; p = ngDocker.findParent(root, p[0])) {
                                        if(p[0].split === 'vertical') {
                                            return false;
                                        }
                                    }
                                    return true;
                                };
                                var needsBottomBorder = function() {
                                    for(var p = ngDocker.findParent(root, node); p !== null; p = ngDocker.findParent(root, p[0])) {
                                        if(p[0].split === 'horizontal') {
                                            return false;
                                        }
                                    }
                                    return true;
                                };
                                if(needsSideBorders()) {
                                    var borderLeft = angular.element('<div class="ng-docker-border ng-docker-vertical-border"></div>');
                                    var borderRight = angular.element('<div class="ng-docker-border ng-docker-vertical-border"></div>');
                                    borderLeft.css('top', config.headerHeight + 'px');
                                    borderLeft.css('width', config.borderWidth + 'px');
                                    borderLeft.css('left', '0');
                                    borderRight.css('top', config.headerHeight + 'px');
                                    borderRight.css('width', config.borderWidth + 'px');
                                    borderRight.css('right', '0');
                                    container.append(borderLeft);
                                    container.append(borderRight);
                                }
                                if(needsBottomBorder()) {
                                    var borderBottom = angular.element('<div class="ng-docker-border ng-docker-horizontal-border"></div>');
                                    borderBottom.css('height', config.borderWidth + 'px');
                                    borderBottom.css('bottom', '0');
                                    container.append(borderBottom);
                                }
                                if(interactive) {
                                    dragListeners[dragId++] = {
                                        element: header,
                                        priority: 0,
                                        threshold: headerDragThreshold,
                                        dragHandler: function(e) {
                                            beginFloating(e, node);
                                        }
                                    };
                                }
                                container.append(panelContainer);
                            }
                        };
                        // construct container for layout elements
                        if(layout !== null) {
                            var allContainer = angular.element(allContainerHTML);
                            allContainer.css({
                                top: config.marginWidth + 'px',
                                left: config.marginWidth + 'px',
                                bottom: config.marginWidth + 'px',
                                right: config.marginWidth + 'px'
                            });
                            construct(layout, layout, allContainer, true);
                            if(layout.split === undefined) {
                                // special case with one root panel
                                ngDockerInternal.childrenWithClass(ngDockerInternal.childrenWithClass(allContainer.children(), 'ng-docker-header'), 'ng-docker-close').on('click', function() {
                                    layoutSet($scope, null);
                                    $scope.$digest();
                                });
                            }
                            $element.append(allContainer);
                            updateContainerTabWidths(allContainer);
                        }
                        if(floatingState !== null) {
                            // construct floating container
                            {
                                var floatingContainer = angular.element(floatingContainerHTML)
                                construct(floatingState.layout, floatingState.layout, floatingContainer, false);
                                var elOffs = ngDockerInternal.elementOffset($element);
                                floatingContainer.css({
                                    left: (floatingState.cursorPosition.pageX + floatingContainerCursorOffset.left - elOffs.left) + 'px',
                                    top: (floatingState.cursorPosition.pageY + floatingContainerCursorOffset.top - elOffs.top) + 'px'
                                });
                                $element.append(floatingContainer);
                                updateContainerTabWidths(floatingContainer);
                            }
                            // construct drop visuals
                            {
                                var target = computeDropTarget();
                                if(target !== null) {
                                    var element = findDropVisualParentElement(target.node);
                                    if(element === null) {
                                        throw new Error('Failed to find element for node', target.node);
                                    }
                                    var ratioPercStr = floatingState.dropSplitRatio*100 + '%';
                                    var visual;
                                    switch(target.where) {
                                        case 'top':
                                            visual = angular.element(dropVisualTopHTML);
                                            visual.css('height', ratioPercStr);
                                            break;
                                        case 'right':
                                            visual = angular.element(dropVisualRightHTML);
                                            visual.css('width', ratioPercStr);
                                            break;
                                        case 'bottom':
                                            visual = angular.element(dropVisualBottomHTML);
                                            visual.css('height', ratioPercStr);
                                            break;
                                        case 'left':
                                            visual = angular.element(dropVisualLeftHTML);
                                            visual.css('width', ratioPercStr);
                                            break;
                                        case 'whole':
                                            visual = angular.element(dropVisualWholeHTML);
                                            break;
                                        case 'tab':
                                            if(target.node.split !== undefined) {
                                                if(target.node.split !== 'tabs') {
                                                    throw new Error('Expected tabs split');
                                                }
                                                var tabNav = findNodeHeaderElement(target.node);
                                                var tabVisual = angular.element(dropVisualTabHTML);
                                                if(target.tabIndex === 0) {
                                                    tabNav.prepend(tabVisual)
                                                } else {
                                                    angular.element(ngDockerInternal.childrenWithClass(tabNav, 'ng-docker-tab')[target.tabIndex-1]).after(tabVisual);
                                                }
                                                var futureLayout = ngDocker.cloneLayout(target.node);
                                                futureLayout.children.splice(target.tabIndex, 0, floatingState.layout);
                                                var tabNavChildren = tabNav.children();
                                                for(var index = 0; index !== tabNavChildren.length; ++index) {
                                                    angular.element(tabNavChildren[index]).css('width', computeTabWidth(futureLayout, ngDockerInternal.elementWidth(tabNav), index) + 'px');
                                                }
                                                visual = null;
                                            } else {
                                                var header = findNodeHeaderElement(target.node);
                                                visual = angular.element(dropVisualTabOnPanelHTML);
                                                var futureLayout = {
                                                    split: 'tabs',
                                                    activeTabIndex: 1,
                                                    children: [
                                                        target.node,
                                                        floatingState.layout
                                                    ]
                                                };
                                                visual.css({
                                                    left: computeTabWidth(futureLayout, ngDockerInternal.elementWidth(header), 0) + 'px',
                                                    width: computeTabWidth(futureLayout, ngDockerInternal.elementWidth(header), 1) + 'px',
                                                    height: config.headerHeight + 'px'
                                                });
                                            }
                                            break;
                                        default:
                                            ngDockerInternal.validationFail();
                                    }
                                    if(visual !== null) {
                                        element.prepend(visual);
                                    }
                                }
                            }
                        }
                    }
                }).catch(function(e) {
                    templateResolver = null;
                    if(!(e instanceof TemplateResolver.AbortedException)) {
                        $exceptionHandler(e);
                    }
                });
            };

            // layout watcher
            var flipflop = true;
            var lastLayout = undefined;
            var lastFloatingState = undefined;
            var lastConfig = undefined;
            $scope.$watch(function() {
                var layout = ngDocker.cloneLayout(layoutGet($scope));
                var flState = cloneFloatingState(floatingState);
                var config = ngDocker.cloneConfig(configGet($scope));
                ngDocker.derefLayout(layout, config);
                if(flState !== null) {
                    ngDocker.derefLayout(flState.layout, config);
                }
                ngDocker.derefConfig(config);
                var changed = 
                       lastLayout !== undefined && !ngDocker.layoutsEqual(lastLayout, layout)
                    || lastFloatingState !== undefined && !floatingStatesEqual(lastFloatingState, flState)
                    || lastConfig !== undefined && !ngDocker.configsEqual(config, lastConfig);
                if(changed) {
                    flipflop = !flipflop;
                }
                lastLayout = layout;
                lastFloatingState = flState;
                lastConfig = config;
                return flipflop;
            }, update);

            angular.element(window).on('resize', update);

            $scope.$on('$destroy', function() {
                angular.element(window).off('resize', update);
            });
        }
    };
}])
.service('ngDockerInternal', [function() {
    // keep in order: most precise to least precise
    this.patterns = [
        {
            split: 'vertical',
            children: [
                [['left', 'right'], 'left'],
                {
                    split: 'vertical',
                    children: [
                        {
                            split: 'horizontal',
                            children: [
                                [[null, 'left', 'right', 'bottom', 'center'], 'center'],
                                [['bottom'], 'bottom']
                            ]
                        },
                        [['left', 'right'], 'right']
                    ]
                }
            ]
        },
        {
            split: 'vertical',
            children: [
                {
                    split: 'vertical',
                    children: [
                        [['left', 'right'], 'left'],
                        {
                            split: 'horizontal',
                            children: [
                                [[null, 'left', 'right', 'bottom', 'center'], 'center'],
                                [['bottom'], 'bottom']
                            ]
                        }
                    ]
                },
                [['left', 'right'], 'right']
            ]
        },
        {
            split: 'vertical',
            children: [
                [['left', 'right'], 'left'],
                {
                    split: 'horizontal',
                    children: [
                        {
                            split: 'vertical',
                            children: [
                                [[null, 'left', 'right', 'bottom', 'center'], 'center'],
                                [['left', 'right'], 'right']
                            ]
                        },
                        [['bottom'], 'bottom']
                    ]
                }
            ]
        },
        {
            split: 'vertical',
            children: [
                {
                    split: 'horizontal',
                    children: [
                        {
                            split: 'vertical',
                            children: [
                                [['left', 'right'], 'left'],
                                [[null, 'left', 'right', 'bottom', 'center'], 'center']
                            ]
                        },
                        [['bottom'], 'bottom']
                    ]
                },
                [['left', 'right'], 'right']
            ]
        },
        {
            split: 'horizontal',
            children: [
                {
                    split: 'vertical',
                    children: [
                        [['left', 'right'], 'left'],
                        {
                            split: 'vertical',
                            children: [
                                [[null, 'left', 'right', 'bottom', 'center'], 'center'],
                                [['left', 'right'], 'right']
                            ]
                        }
                    ]
                },
                [['bottom'], 'bottom']
            ]
        },
        {
            split: 'horizontal',
            children: [
                {
                    split: 'vertical',
                    children: [
                        {
                            split: 'vertical',
                            children: [
                                [['left', 'right'], 'left'],
                                [[null, 'left', 'right', 'bottom', 'center'], 'center']
                            ]
                        },
                        [['left', 'right'], 'right']
                    ]
                },
                [['bottom'], 'bottom']
            ]
        },
        {
            split: 'vertical',
            children: [
                [['left', 'right'], 'left'],
                {
                    split: 'horizontal',
                    children: [
                        [[null, 'bottom', 'center'], 'center'],
                        [['bottom'], 'bottom']
                    ]
                }
            ]
        },
        {
            split: 'vertical',
            children: [
                {
                    split: 'horizontal',
                    children: [
                        [[null, 'bottom', 'center'], 'center'],
                        [['bottom'], 'bottom']
                    ]
                },
                [['left', 'right'], 'right']
            ]
        },
        {
            split: 'vertical',
            children: [
                [['left', 'right'], 'left'],
                {
                    split: 'vertical',
                    children: [
                        [[null, 'left', 'right', 'center'], 'center'],
                        [['left', 'right'], 'right']
                    ]
                }
            ]
        },
        {
            split: 'vertical',
            children: [
                {
                    split: 'vertical',
                    children: [
                        [['left', 'right'], 'left'],
                        [[null, 'left', 'right', 'center'], 'center']
                    ]
                },
                [['left', 'right'], 'right']
            ]
        },
        {
            split: 'horizontal',
            children: [
                {
                    split: 'vertical',
                    children: [
                        [[null, 'bottom', 'center'], 'center'],
                        [['left', 'right'], 'right']
                    ]
                },
                [['bottom'], 'bottom']
            ]
        },
        {
            split: 'horizontal',
            children: [
                {
                    split: 'vertical',
                    children: [
                        [['left', 'right'], 'left'],
                        [[null, 'bottom', 'center'], 'center']
                    ]
                },
                [['bottom'], 'bottom']
            ]
        },
        {
            split: 'vertical',
            children: [
                [['left', 'right'], 'left'],
                {
                    split: 'vertical',
                    children: [
                        [['bottom'], 'bottom'],
                        [['left', 'right'], 'right']
                    ]
                }
            ]
        },
        {
            split: 'vertical',
            children: [
                {
                    split: 'vertical',
                    children: [
                        [['left', 'right'], 'left'],
                        [['bottom'], 'bottom']
                    ]
                },
                [['left', 'right'], 'right']
            ]
        },
        {
            split: 'vertical',
            children: [
                [['left', 'right'], 'left'],
                {
                    split: 'horizontal',
                    children: [
                        [['left', 'right'], 'right'],
                        [['bottom'], 'bottom']
                    ]
                }
            ]
        },
        {
            split: 'vertical',
            children: [
                {
                    split: 'horizontal',
                    children: [
                        [['left', 'right'], 'left'],
                        [['bottom'], 'bottom']
                    ]
                },
                [['left', 'right'], 'right']
            ]
        },
        {
            split: 'horizontal',
            children: [
                {
                    split: 'vertical',
                    children: [
                        [['left', 'right'], 'left'],
                        [['left', 'right'], 'right']
                    ]
                },
                [['bottom'], 'bottom']
            ]
        },
        {
            split: 'horizontal',
            children: [
                [[null, 'bottom', 'center'], 'center'],
                [['bottom'], 'bottom']
            ]
        },
        {
            split: 'vertical',
            children: [
                [['left', 'right'], 'left'],
                [[null, 'center'], 'center']
            ]
        },
        {
            split: 'vertical',
            children: [
                [[null, 'center'], 'center'],
                [['left', 'right'], 'right']
            ]
        },
        {
            split: 'vertical',
            children: [
                [['bottom'], 'bottom'],
                [['left', 'right'], 'right']
            ]
        },
        {
            split: 'vertical',
            children: [
                [['left', 'right'], 'left'],
                [['bottom'], 'bottom']
            ]
        },
        {
            split: 'horizontal',
            children: [
                [['left'], 'left'],
                [['bottom'], 'bottom']
            ]
        },
        {
            split: 'horizontal',
            children: [
                [['right'], 'right'],
                [['bottom'], 'bottom']
            ]
        },
        {
            split: 'vertical',
            children: [
                [['left', 'right'], 'left'],
                [['left', 'right'], 'right']
            ]
        },
        [[null, 'center'], 'center'],
        [['left'], 'left'],
        [['right'], 'right'],
        [['bottom'], 'bottom']
    ];

    var insertCenterStrategies = [
        {
            from: {
                split: 'vertical',
                children: [
                    'left',
                    {
                        split: 'vertical',
                        children: [
                            'bottom',
                            'right'
                        ]
                    }
                ]
            },
            split: 'horizontal',
            index: 0,
            node: function(node) {
                return node.children[1].children[0]
            }
        },
        {
            from: {
                split: 'vertical',
                children: [
                    {
                        split: 'vertical',
                        children: [
                            'left',
                            'bottom'
                        ]
                    },
                    'right'
                ]
            },
            split: 'horizontal',
            index: 0,
            node: function(node) {
                return node.children[0].children[1]
            }
        },
        {
            from: {
                split: 'vertical',
                children: [
                    'left',
                    {
                        split: 'horizontal',
                        children: [
                            'right',
                            'bottom'
                        ]
                    }
                ]
            },
            split: 'vertical',
            index: 0,
            node: function(node) {
                return node.children[1].children[0];
            }
        },
        {
            from: {
                split: 'vertical',
                children: [
                    {
                        split: 'horizontal',
                        children: [
                            'left',
                            'bottom'
                        ]
                    },
                    'right'
                ]
            },
            split: 'vertical',
            index: 1,
            node: function(node) {
                return node.children[0].children[0];
            }
        },
        {
            from: {
                split: 'horizontal',
                children: [
                    {
                        split: 'vertical',
                        children: [
                            'left',
                            'right'
                        ]
                    },
                    'bottom'
                ]
            },
            split: 'vertical',
            index: 1,
            node: function(node) {
                return node.children[0].children[0];
            }
        },
        {
            from: {
                split: 'vertical',
                children: [
                    'bottom',
                    'right'
                ]
            },
            split: 'horizontal',
            index: 0,
            node: function(node) {
                return node.children[0];
            }
        },
        {
            from: {
                split: 'vertical',
                children: [
                    'left',
                    'bottom'
                ]
            },
            split: 'horizontal',
            index: 0,
            node: function(node) {
                return node.children[1];
            }
        },
        {
            from: {
                split: 'horizontal',
                children: [
                    'left',
                    'bottom'
                ]
            },
            split: 'vertical',
            index: 1,
            node: function(node) {
                return node.children[0];
            }
        },
        {
            from: {
                split: 'vertical',
                children: [
                    'left',
                    'right'
                ]
            },
            split: 'vertical',
            index: 1,
            node: function(node) {
                return node.children[0]
            }
        },
        {
            from: {
                split: 'vertical',
                children: [
                    'right',
                    'bottom'
                ]
            },
            split: 'vertical',
            index: 0,
            node: function(node) {
                return node.children[0];
            }
        },
        {
            from: 'left',
            split: 'vertical',
            index: 1,
            node: function(node) {
                return node;
            }
        },
        {
            from: 'right',
            split: 'vertical',
            index: 0,
            node: function(node) {
                return node;
            }
        },
        {
            from: 'bottom',
            split: 'horizontal',
            index: 0,
            node: function(node) {
                return node;
            }
        }
    ];

    var insertLeftStrategies = [
        {
            from: {
                split: 'vertical',
                children: [
                    {
                        split: 'horizontal',
                        children: [
                            'center',
                            'bottom'
                        ]
                    },
                    'right'
                ]
            },
            split: 'vertical',
            index: 0,
            node: function(node) {
                return node;
            }
        },
        {
            from: {
                split: 'horizontal',
                children: [
                    {
                        split: 'vertical',
                        children: [
                            'center',
                            'right'
                        ]
                    },
                    'bottom'
                ]
            },
            split: 'vertical',
            index: 0,
            node: function(node) {
                return node.children[0].children[0];
            }
        },
        {
            from: {
                split: 'horizontal',
                children: [
                    'center',
                    'bottom'
                ]
            },
            split: 'vertical',
            index: 0,
            node: function(node) {
                return node.children[0];
            }
        },
        {
            from: {
                split: 'vertical',
                children: [
                    'center',
                    'right'
                ]
            },
            split: 'vertical',
            index: 0,
            node: function(node) {
                return node.children[0];
            }
        },
        {
            from: {
                split: 'vertical',
                children: [
                    'bottom',
                    'right'
                ]
            },
            split: 'horizontal',
            index: 0,
            node: function(node) {
                return node.children[0];
            }
        },
        {
            from: {
                split: 'horizontal',
                children: [
                    'right',
                    'bottom'
                ]
            },
            split: 'horizontal',
            index: 0,
            node: function(node) {
                return node.children[0];
            }
        },
        {
            from: 'center',
            split: 'vertical',
            index: 0,
            node: function(node) {
                return node;
            }
        },
        {
            from: 'right',
            split: 'vertical',
            index: 0,
            node: function(node) {
                return node;
            }
        },
        {
            from: 'bottom',
            split: 'horizontal',
            index: 0,
            node: function(node) {
                return node;
            }
        }
    ];

    var insertRightStrategies = [
        {
            from: {
                split: 'vertical',
                children: [
                    'left',
                    {
                        split: 'horizontal',
                        children: [
                            'center',
                            'bottom'
                        ]
                    }
                ]
            },
            split: 'vertical',
            index: 1,
            node: function(node) {
                return node;
            }
        },
        {
            from: {
                split: 'horizontal',
                children: [
                    {
                        split: 'vertical',
                        children: [
                            'left',
                            'center'
                        ]
                    },
                    'bottom'
                ]
            },
            split: 'vertical',
            index: 1,
            node: function(node) {
                return node.children[0];
            }
        },
        {
            from: {
                split: 'horizontal',
                children: [
                    'center',
                    'bottom'
                ]
            },
            split: 'vertical',
            index: 1,
            node: function(node) {
                return node.children[0];
            }
        },
        {
            from: {
                split: 'vertical',
                children: [
                    'left',
                    'center'
                ]
            },
            split: 'vertical',
            index: 1,
            node: function(node) {
                return node;
            }
        },
        {
            from: {
                split: 'vertical',
                children: [
                    'left',
                    'bottom'
                ]
            },
            split: 'horizontal',
            index: 0,
            node: function(node) {
                return node.children[1];
            }
        },
        {
            from: {
                split: 'horizontal',
                children: [
                    'left',
                    'bottom'
                ]
            },
            split: 'vertical',
            index: 1,
            node: function(node) {
                return node.children[0];
            }
        },
        {
            from: 'center',
            split: 'vertical',
            index: 1,
            node: function(node) {
                return node;
            }
        },
        {
            from: 'left',
            split: 'vertical',
            index: 1,
            node: function(node) {
                return node;
            }
        },
        {
            from: 'bottom',
            split: 'horizontal',
            index: 0,
            node: function(node) {
                return node;
            }
        }
    ];

    var insertBottomStrategies = [
        {
            from: {
                split: 'vertical',
                children: [
                    'left',
                    {
                        split: 'vertical',
                        children: [
                            'center',
                            'right'
                        ]
                    }
                ]
            },
            split: 'horizontal',
            index: 1,
            node: function(node) {
                return node;
            }
        },
        {
            from: {
                split: 'vertical',
                children: [
                    {
                        split: 'vertical',
                        children: [
                            'left',
                            'center'
                        ]
                    },
                    'right'
                ]
            },
            split: 'horizontal',
            index: 1,
            node: function(node) {
                return node;
            }
        },
        {
            from: {
                split: 'vertical',
                children: [
                    'left',
                    'center'
                ]
            },
            split: 'horizontal',
            index: 1,
            node: function(node) {
                return node;
            }
        },
        {
            from: {
                split: 'vertical',
                children: [
                    'center',
                    'right'
                ]
            },
            split: 'horizontal',
            index: 1,
            node: function(node) {
                return node;
            }
        },
        {
            from: {
                split: 'vertical',
                children: [
                    'left',
                    'right'
                ]
            },
            split: 'horizontal',
            index: 1,
            node: function(node) {
                return node;
            }
        },
        {
            from: 'center',
            split: 'horizontal',
            index: 1,
            node: function(node) {
                return node;
            }
        },
        {
            from: 'left',
            split: 'horizontal',
            index: 1,
            node: function(node) {
                return node;
            }
        },
        {
            from: 'right',
            split: 'horizontal',
            index: 1,
            node: function(node) {
                return node;
            }
        }
    ];

    this.insertStrategies = {
        'center': insertCenterStrategies,
        'left': insertLeftStrategies,
        'right': insertRightStrategies,
        'bottom': insertBottomStrategies
    };

    this.computeMatchPrecision = function(match) {
        var precision = 0;
        var f = function(m) {
            if(typeof m === 'object') {
                m.children.forEach(f);
            } else if(typeof m === 'string') {
                ++precision;
            } else {
                throw new Error('Unexpected ' + m);
            }
        };
        f(match);
        return precision;
    };

    this.tryMatchLayoutPattern = function(pattern, root) {
        var that = this;
        var f = function(p, l) {
            if(p instanceof Array) {
                var gravity = that.computeLayoutGravity(l);
                if(p[0].indexOf(gravity) >= 0) {
                    return p[1];
                } else {
                    return null;
                }
            } else if(p.split === l.split && p.children.length === l.children.length) {
                var children = [];
                for(var i = 0; i !== p.children.length; ++i) {
                    var child = f(p.children[i], l.children[i]);
                    if(child !== null) {
                        children.push(child);
                    } else {
                        return null;
                    }
                }
                return {
                    split: p.split,
                    children: children
                };
            } else {
                return null;
            }
        };
        return f(pattern, root);
    };

    this.matchLayoutPattern = function(root) {
        if(root === null) {
            throw new Error();
        }
        var that = this;
        var matchLayout = function(root) {
            // matching attempts begin from most precise to least precise, so
            // the first match we find will automatically be the best match
            for(var i = 0; i !== that.patterns.length; ++i) {
                var pattern = that.patterns[i];
                var match = that.tryMatchLayoutPattern(pattern, root);
                if(match !== null) {
                    return match;
                }
            }
            throw new Error('layout does not match any patterns');
        };
        var series = [root];
        {
            var next = root;
            while(next.split !== undefined && next.split === 'horizontal') {
                series.push(next.children[1]);
                next = next.children[1];
            }
        }
        var bestMatch = null;
        var bestMatchPrecision = null;
        var bestMatchIndex = null;
        for(var i = 0; i !== series.length; ++i) {
            var match = matchLayout(series[i]);
            var score = this.computeMatchPrecision(match);
            if(bestMatch === null || bestMatchPrecision > score) {
                bestMatch = match;
                bestMatchPrecision = score;
                bestMatchIndex = i;
            }
        }
        return {
            match: bestMatch,
            node: series[bestMatchIndex]
        };
    };

    this.matchesAreSame = function(match1, match2) {
        var f = function(m1, m2) {
            if(typeof m1 !== typeof m2) {
                return false;
            }
            switch(typeof m1) {
                case 'string':
                    if(m1 !== m2) {
                        return false;
                    }
                    break;
                case 'object':
                    if(m1.split !== m2.split) {
                        return false;
                    }
                    if(m1.children.length !== m2.children.length) {
                        return false;
                    }
                    for(var i = 0; i !== m1.children.length; ++i) {
                        if(!f(m1.children[i], m2.children[i])) {
                            return false;
                        }
                    }
                    break;
                default:
                    throw new Error();
            }
            return true;
        };
        return f(match1, match2);
    };

    this.REF_PREFIX = '$$ngDockerRef:';

    this.ref = function(name) {
        return this.REF_PREFIX + name;
    };

    this.isRef = function(x) {
        return typeof x === 'string' && x.indexOf(this.REF_PREFIX) === 0;
    };

    this.deref = function(x, config) {
        var count = 0;
        var res = x;
        while(this.isRef(res)) {
            var name = res.substring(this.REF_PREFIX.length);
            if(!(name in config.refs)) {
                throw new Error('Reference \'' + name + '\' is not defined');
            }
            res = config.refs[name];
            ++count;
            if(count >= 1000) {
                var xname = res.substring(this.REF_PREFIX.length);
                throw new Error('Too many levels of references: started with \'' + xname + '\'');
            }
        }
        return res;
    };

    this.findLeaves = function(layout) {
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

    this.validateLayout = function(root) {
        if(!root) {
            return;
        }
        if(typeof root !== 'object') {
            throw new Error('Layout must be an object');
        }
        if(root.split !== undefined) {
            switch(root.split) {
                case 'horizontal':
                case 'vertical':
                    if(root.ratio === undefined) {
                        throw new Error('ratio must be defined for a horizontal or vertical split');
                    }
                    if(typeof root.ratio !== 'number') {
                        throw new Error('ratio must be a number');
                    }
                    if(root.ratio < 0 || root.ratio > 1) {
                        throw new Error('ratio must be at least 0 and at most 1');
                    }
                    break;
                case 'tabs':
                    if(root.ratio !== undefined) {
                        throw new Error('ratio is not valid for a tabs split');
                    }
                    if(root.activeTabIndex === undefined) {
                        throw new Error('activeTabIndex must be defined for a tabs split');
                    }
                    if(root.activeTabIndex < 0 || root.activeTabIndex >= root.children.length) {
                        throw new Error('activeTabIndex out of bounds');
                    }
                    break;
                default:
                    throw new Error('Invalid split type \'' + root.split + '\'');
            }
            if(!(root.children instanceof Array)) {
                throw new Error('split must define a children array');
            }
            switch(root.split) {
                case 'horizontal':
                case 'vertical':
                    if(root.children.length !== 2) {
                        throw new Error('length of children must be 2 for a horizontal or vertical split');
                    }
                    break;
                case 'tabs':
                    if(root.children.length < 2) {
                        throw new Error('length of children must be at least 2 for a tabs split');
                    }
                    break;
                default:
                    this.validationFail();
            }
            root.children.forEach(this.validateLayout.bind(this));
        } else {
            if(root.id === undefined) {
                throw new Error('id must be defined for a panel');
            }
            if(typeof root.id !== 'string') {
                throw new Error('id must be a string');
            }
            if(root.title === undefined) {
                throw new Error('title must be defined for a panel');
            }
            if(typeof root.title !== 'string') {
                throw new Error('title must be a string');
            }
            if(root.closeable !== undefined && typeof root.closeable !== 'boolean') {
                throw new Error('closeable must be a boolean');
            }
            if(root.icon !== undefined) {
                if(typeof root.icon !== 'object') {
                    throw new Error('icon must be an object');
                }
                this.validateTemplate(root.icon);
            }
            if(root.panel === undefined) {
                throw new Error('panel must be defined for a panel');
            }
            if(typeof root.panel !== 'object') {
                throw new Error('panel must be an object');
            }
            this.validateTemplate(root.panel);
        }
        if(root.gravity !== undefined && typeof root.gravity !== 'string') {
            throw new Error('gravity must be a string');
        }
        if(root.group !== undefined && typeof root.group !== 'string') {
            throw new Error('group must be a string');
        }
        if(root.data !== undefined && typeof root.data !== 'object') {
            throw new Error('data must be an object');
        }
        var seenIds = {};
        this.findLeaves(root).forEach(function(root) {
            if(seenIds[root.id]) {
                throw new Error('Duplicate panel id \'' + root.id + '\'');
            } else {
                seenIds[root.id] = true;
            }
        });
    };

    // dereference all references in the layout
    this.derefLayout = function(root, config) {
        if(root !== null) {
            if(root.split !== undefined) {
                for(var i = 0; i !== root.children.length; ++i) {
                    this.derefLayout(root.children[i], config);
                }
            } else {
                this.derefTemplate(root.icon, config);
                this.derefTemplate(root.panel, config);
            }
        }
        return root;
    };

    this.cloneLayout = function(root) {
        if(root === null) {
            return null;
        } else {
            var result = {};
            if(root.split !== undefined) {
                result.split = root.split;
                switch(root.split) {
                    case 'vertical':
                    case 'horizontal':
                        result.ratio = root.ratio;
                        break;
                    case 'tabs':
                        result.activeTabIndex = root.activeTabIndex;
                        break;
                    default:
                        ngDockerInternal.validationFail();
                }
                result.children = root.children.map(this.cloneLayout.bind(this));
            } else {
                result.id = root.id;
                result.title = root.title;
                if(root.closeable !== undefined) {
                    result.closeable = root.closeable;
                }
                result.panel = this.cloneTemplate(root.panel);
                if(root.icon !== undefined) {
                    result.icon = this.cloneTemplate(root.icon);
                }
            }
            if(root.gravity !== undefined) {
                result.gravity = root.gravity;
            }
            if(root.group !== undefined) {
                result.group = root.group;
            }
            if(root.data !== undefined) {
                result.data = {};
                Object.keys(root.data).forEach(function(k) {
                    result.data[k] = root.data[k];
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
                } else if(a.title !== b.title) {
                    return false;
                } else if(a.closeable !== b.closeable) {
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
            if(a.gravity !== b.gravity) {
                return false;
            }
            if(a.group !== b.group) {
                return false;
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

    this.cloneRefs = function(refs) {
        var res = {};
        for(var k in refs) {
            res[k] = refs[k];
        }
        return res;
    };

    this.refsEqual = function(a, b) {
        for(var k in a) {
            if(a[k] !== b[k]) {
                return false;
            }
        }
        for(var k in b) {
            if(a[k] !== b[k]) {
                return false;
            }
        }
        return true;
    };

    this.derefConfig = function(config) {
        if(config) {
            this.derefTemplate(config.closeButton);
            for(var k in config.refs) {
                config.refs[k] = this.deref(config.refs[k], config);
            }
        }
    };

    this.cloneConfig = function(config) {
        if(!config) {
            return angular.copy(config);
        }
        return {
            headerHeight: config.headerHeight,
            borderWidth: config.borderWidth,
            getterSetter: config.getterSetter,
            closeButton: this.cloneTemplate(config.closeButton),
            refs: this.cloneRefs(config.refs)
        };
    };

    this.configsEqual = function(a, b) {
        if(!a && b) {
            return false;
        } else if(a && !b) {
            return false;
        } else if(a && b) {
            if(a.headerHeight !== b.headerHeight) {
                return false;
            }
            if(a.borderWidth !== b.borderWidth) {
                return false;
            }
            if(a.getterSetter !== b.getterSetter) {
                return false;
            }
            if(!this.templatesEqual(a.closeButton, b.closeButton)) {
                return false;
            }
            if(!this.refsEqual(a.refs, b.refs)) {
                return false;
            }
        } else if(!angular.equals(a, b)) {
            return false;
        }
        return true;
    };

    // returns null if the node has no parent
    // returns undefined if the node could not be found in the tree
    // otherwise returns [node, childIndex]
    this.findParent = function(root, node) {
        var that = this;
        if(this.layoutsEqual(root, node)) {
            return null; // Layout is root (no parent)
        } else if(root.split !== undefined) {
            var f = function(l) {
                for(var i = 0; i !== l.children.length; ++i) {
                    var child = l.children[i];
                    if(that.layoutsEqual(child, node)) {
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
            var result = f(root);
            if(result !== undefined) {
                return result;
            }
        }
        return undefined; // Failed to find node
    };

    this.findLeafWithId = function(root, id) {
        if(root === null) {
            return null;
        } else {
            var f = function(node) {
                if(node.split !== undefined) {
                    for(var i = 0; i !== node.children.length; ++i) {
                        var result = f(node.children[i]);
                        if(result !== null) {
                            return result;
                        }
                    }
                    return null;
                } else if(node.id === id) {
                    return node;
                } else {
                    return null;
                }
            };
            return f(root);
        }
    };

    this.computeInsertRatio = function(root, insertStrategy, matchRoot, dockerRatio) {
        var ratio = insertStrategy.index === 0 ? dockerRatio : 1 - dockerRatio;
        var node = insertStrategy.node(matchRoot);
        var p = this.findParent(root, node);
        while(p !== null) {
            if(p[0].split === insertStrategy.split) {
                ratio = p[1] === 0 ? ratio/p[0].ratio : ratio/(1-p[0].ratio);
            }
            node = p[0];
            p = this.findParent(root, node);
        }
        return ratio;
    };

    this.findInsertStrategy = function(match, nodeToInsert) {
        var gravity = this.computeLayoutGravity(nodeToInsert);
        var strategies = this.insertStrategies[gravity];
        for(var i = 0; i !== strategies.length; ++i) {
            var strategy = strategies[i];
            if(this.matchesAreSame(match, strategy.from)) {
                return strategy;
            }
        }
        throw new Error('failed to find insert strategy for match');
    };

    // computes the gravity for a layout
    // if the gravity is not uniform returns null
    this.computeLayoutGravity = function(root) {
        if(root.split !== undefined) {
            return root.children.map(this.computeLayoutGravity.bind(this)).reduce(function(accum, val) {
                if(accum !== val) {
                    return null;
                } else {
                    return accum;
                }
            });
        } else {
            if(root.gravity === undefined) {
                throw new Error('non-split panels must have a defined gravity');
            }
            return root.gravity;
        }
    };

    this.computeLayoutTitle = function(root) {
        if(root.split !== undefined) {
            return root.children.map(this.computeLayoutTitle.bind(this)).join(', ');
        } else {
            return root.title;
        }
    };

    this.validateTemplate = function(template) {
        var that = this;
        if(template.templateUrl === undefined && template.template === undefined) {
            throw new Error('templateUrl or template must be defined for a normal panel');
        }
        if(template.templateUrl !== undefined && typeof template.templateUrl !== 'string') {
            throw new Error('templateUrl must be a string');
        }
        if(template.template !== undefined && typeof template.template !== 'string') {
            throw new Error('template must be a string');
        }
        if(template.resolve !== undefined && typeof template.resolve !== 'object') {
            throw new Error('resolve must be an object');
        }
        if(template.scope !== undefined) {
            if(typeof template.scope !== 'object') {
                throw new Error('scope must be an object');
            } else {
                ['closeThisPanel'].forEach(function(k) {
                    if(template.scope[k]) {
                        throw new Error('\'' + k + '\' cannot be added to the panel\'s scope, it is reserved for ngDocker');
                    }
                });
            }
        }
    };

    this.derefTemplate = function(template, config) {
        if(template.resolve !== undefined) {
            for(var k in template.resolve) {
                template.resolve[k] = this.deref(template.resolve[k], config);
            }
        }
        if(template.scope !== undefined) {
            for(var k in template.scope) {
                template.scope[k] = this.deref(template.scope[k], config);
            }
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
        if(template.resolve !== undefined) {
            result.resolve = {};
            Object.keys(template.resolve).forEach(function(k) {
                result.resolve[k] = template.resolve[k];
            });
        }
        if(template.scope !== undefined) {
            result.scope = {};
            Object.keys(template.scope).forEach(function(k) {
                result.scope[k] = template.scope[k];
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
        if(a.resolve === undefined && b.resolve !== undefined) {
            return false;
        }
        if(a.resolve !== undefined && b.resolve === undefined) {
            return false;
        }
        if(a.resolve !== undefined && b.resolve !== undefined) {
            if(!Object.keys(a.resolve).reduce(function(accum, k) {
                return accum && a.resolve[k] === b.resolve[k];
            }, true)) {
                return false;
            }
            if(!Object.keys(b.resolve).reduce(function(accum, k) {
                return accum && a.resolve[k] === b.resolve[k];
            }, true)) {
                return false;
            }
        }
        if(a.scope === undefined && b.scope !== undefined) {
            return false;
        }
        if(a.scope !== undefined && b.scope === undefined) {
            return false;
        }
        if(a.scope !== undefined && b.scope !== undefined) {
            if(!Object.keys(a.scope).reduce(function(accum, k) {
                return accum && a.scope[k] === b.scope[k];
            }, true)) {
                return false;
            }
            if(!Object.keys(b.scope).reduce(function(accum, k) {
                return accum && a.scope[k] === b.scope[k];
            }, true)) {
                return false;
            }
        }
        return true;
    };

    this.validationFail = function() {
        throw new Error('This case was supposed to be rejected by input validation');
    };

    this.childrenWithClass = function(sel, cls) {
        var res = [];
        for(var i = 0; i !== sel.length; ++i) {
            var el = sel[i];
            for(var j = 0; j !== el.children.length; ++j) {
                var c = el.children[j];
                if(c.classList.contains(cls)) {
                    if(res.indexOf(c) < 0) {
                        res.push(c);
                    }
                }
            }
        }
        return angular.element(res);
    };

    this.elementOffset = function(sel) {
        if(sel.length !== 1) {
            throw new Error('elementOffset only supported for selectors of 1 element');
        }
        var el = sel[0];
        var rect = el.getBoundingClientRect();
        var win = el.ownerDocument.defaultView;
        return {
            top: rect.top + win.pageYOffset,
            left: rect.left + win.pageXOffset
        };
    };

    this.elementWidth = function(sel) {
        if(sel.length !== 1) {
            throw new Error('elementWidth only supported for selectors of 1 element');
        }
        var el = sel[0];
        return el.getBoundingClientRect().width;
    };

    this.elementHeight = function(sel) {
        if(sel.length !== 1) {
            throw new Error('elementHeight only supported for selectors of 1 element');
        }
        var el = sel[0];
        return el.getBoundingClientRect().height;
    };
}]);
