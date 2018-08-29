angular.module('ngDocker', [])
.service('ngDockerUtil', ['ngDockerInternal', function(ngDockerInternal) {
    var that = this;

    this.findLeaves = function(root) {
        return ngDockerInternal.findLeaves(root);
    };

    this.validateLayout = function(root) {
        return ngDockerInternal.validateLayout(root);
    };

    this.cloneLayout = function(root) {
        return ngDockerInternal.cloneLayout(root);
    };

    this.layoutsEqual = function(a, b) {
        return ngDockerInternal.layoutsEqual(a, b);
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
        var panelLayouts = this.findLeaves(root);
        for(var i = 0; i !== panelLayouts.length; ++i) {
            var panelLayout = panelLayouts[i];
            if(panelLayout.id === id) {
                var p = this.findParent(root, panelLayout);
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
.directive('ngDocker', ['$parse', '$compile', '$templateCache', '$templateRequest', '$q', '$exceptionHandler', '$controller', 'ngDockerUtil', 'ngDockerInternal', function($parse, $compile, $templateCache, $templateRequest, $q, $exceptionHandler, $controller, ngDockerUtil, ngDockerInternal) {
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
                ngDockerInternal.validationFail();
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

            var findParent = function(node) {
                var p = ngDockerUtil.findParent(layoutGet(layoutScope), node);
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
                    if(elementNode !== undefined && ngDockerUtil.layoutsEqual(elementNode, node)) {
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
                                    return element.children('.ng-docker-tab-nav');
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

            var replaceNode = function(node, replacement) {
                var p = findParent(node);
                if(p === null) {
                    layoutSet(layoutScope, replacement);
                } else {
                    p[0].children[p[1]] = replacement;
                }
            };

            var removeSplitChild = function(node, index) {
                layoutSet(layoutScope, ngDockerUtil.removeSplitChild(layoutGet(layoutScope), node, index));
            };

            var removeLeafWithId = function(id) {
                layoutSet(layoutScope, ngDockerUtil.removeLeafWithId(layoutGet(layoutScope), id));
            };

            var removeNode = function(node) {
                layoutSet(layoutScope, ngDockerUtil.removeNode(layoutGet(layoutScope), node));
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
                var root = layoutGet(layoutScope);
                if(root === null) {
                    // drop as root
                    return {
                        where: 'whole',
                        node: null
                    };
                } else {
                    // check panels (for vertical/horizontal split)
                    {
                        var panelIds = ngDockerUtil.findLeaves(root).map(function(l) {
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
                                    if(floatingState.cursorPosition.pageX >= header.offset().left && floatingState.cursorPosition.pageX < header.offset().left + header.width()
                                        && floatingState.cursorPosition.pageY >= header.offset().top && floatingState.cursorPosition.pageY < header.offset().top + header.height())
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
                        layoutSet(layoutScope, floatingState.layout);
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
                var tabsplits = container.find('.ng-docker-tabsplit');
                tabsplits.each(function() {
                    var tabsplit = jQuery(this);
                    var tabNav = tabsplit.children('.ng-docker-tab-nav');
                    var node = tabsplit.data('ngDockerNode');
                    var tabs = tabNav.children('.ng-docker-tab');
                    for(var i = 0; i !== node.children.length; ++i) {
                        var tab = jQuery(tabs[i]);
                        tab.css('width', computeTabWidth(node, tabNav.width(), i));
                    }
                    var leftBorder = tabNav.children('.ng-docker-tab-nav-border-left');
                    var rightBorder = tabNav.children('.ng-docker-tab-nav-border-right');
                    var activeTab = jQuery(tabs[node.activeTabIndex]);
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

            var beginFloating = function(e, node) {
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

                var root = layoutGet(layoutScope);

                var leaves =  [];
                if(root !== null) {
                    ngDockerUtil.validateLayout(root);
                    Array.prototype.push.apply(leaves, ngDockerUtil.findLeaves(root));
                }
                if(floatingState !== null) {
                    ngDockerUtil.validateLayout(floatingState.layout);
                    Array.prototype.push.apply(leaves, ngDockerUtil.findLeaves(floatingState.layout));
                }

                // load any uncached templates before proceeding
                templateRequestPack = new TemplateRequestPack();
                var maybeAddTemplate = function(template) {
                    if(template.templateUrl !== undefined && $templateCache.get(template.templateUrl) === undefined) {
                        templateRequestPack.add(template.templateUrl);
                    }
                };
                leaves.forEach(function(leaf) {
                    if(leaf.icon !== undefined) {
                        maybeAddTemplate(leaf.icon);
                    }
                    maybeAddTemplate(leaf.panel);
                });
                templateRequestPack.finalize().then(function() {
                    templateRequestPack = null;
                    // adapt any previously constructed icons and panels to the new leaf and discard any unused ones
                    {
                        var tryAdapt = function(m, leavesById) {
                            var next = {};
                            Object.keys(m).forEach(function(k) {
                                var el = m[k];
                                var elLayout = el.data('ngDockerNode');
                                var leaf = leavesById[elLayout.id];
                                if(!leaf || !ngDockerUtil.layoutsEqual(leaf, elLayout)) {
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
                            panel.data('ngDockerNode', leaf);
                            panels[leaf.id] = panel;
                        }
                        if(leaf.icon !== undefined && !icons[leaf.id]) {
                            var iconScope = newTemplateScope(leaf.icon);
                            var icon = $compile(getTemplateTemplateString(leaf.icon))(iconScope);
                            icon.data('ngDockerNode', leaf);
                            maybeLoadTemplateController(leaf.icon, iconScope, icon);
                            icons[leaf.id] = icon;
                        }
                    });

                    // clear drag listeners
                    dragListeners = {};

                    // clear the constructed DOM
                    jQuery($element[0]).children('.ng-docker-all-container, .ng-docker-floating-container, .ng-docker-drop-visual').remove();

                    // construct the new DOM
                    {
                        var dragId = 0;
                        var construct = function(node, parent, interactive) {
                            if(node.split !== undefined) {
                                var element;
                                switch(node.split) {
                                    case 'vertical':
                                        {
                                            element = jQuery(vsplitHTML);
                                            var left = element.children('.ng-docker-left');
                                            var sep = element.children('.ng-docker-separator');
                                            var right = element.children('.ng-docker-right');
                                            construct(node.children[0], left, interactive);
                                            construct(node.children[1], right, interactive);
                                            left.css('width', 100*node.ratio + '%');
                                            sep.css('left', 'calc(' + 100*node.ratio + '% - 1px)');
                                            right.css('width', 100*(1-node.ratio) + '%');
                                            if(interactive) {
                                                left.children().children('.ng-docker-header').children('.ng-docker-close').click(function() {
                                                    removeSplitChild(node, 0);
                                                    $scope.$digest();
                                                });
                                                right.children().children('.ng-docker-header').children('.ng-docker-close').click(function() {
                                                    removeSplitChild(node, 1);
                                                    $scope.$digest();
                                                });
                                                dragListeners[dragId++] = {
                                                    element: sep,
                                                    priority: 1,
                                                    dragHandler: function(e) {
                                                        node.ratio = Math.max(0, Math.min(1, (e.pageX - element.offset().left)/element.width()));
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
                                            construct(node.children[0], top, interactive);
                                            construct(node.children[1], bottom, interactive);
                                            top.css('height', 100*node.ratio + '%');
                                            sep.css('top', 'calc(' + 100*node.ratio + '% - 1px)');
                                            bottom.css('height', 100*(1-node.ratio) + '%');
                                            if(interactive) {
                                                top.children().children('.ng-docker-header').children('.ng-docker-close').click(function() {
                                                    removeSplitChild(node, 0);
                                                    $scope.$digest();
                                                });
                                                bottom.children().children('.ng-docker-header').children('.ng-docker-close').click(function() {
                                                    removeSplitChild(node, 1);
                                                    $scope.$digest();
                                                });
                                                dragListeners[dragId++] = {
                                                    element: sep,
                                                    priority: 2,
                                                    dragHandler: function(e) {
                                                        node.ratio = Math.max(0, Math.min(1, (e.pageY - element.offset().top)/element.height()));
                                                    }
                                                };
                                            }
                                        }
                                        break;
                                    case 'tabs':
                                        {
                                            element = jQuery(tabsplitHTML);
                                            var tabNav = element.children('.ng-docker-tab-nav');
                                            for(var i = 0; i !== node.children.length; ++i) (function(i) {
                                                var tabLayout = node.children[i];
                                                // note: the width for this tab is calculated after the entire DOM is built: see updateContainerTabWidths
                                                var tab = jQuery(tabHTML);
                                                tab.click(function() {
                                                    node.activeTabIndex = i;
                                                    $scope.$digest();
                                                });
                                                var title = tab.children('.ng-docker-title');
                                                title.children('.ng-docker-icon').after(jQuery('<div></div>').text(ngDockerInternal.computeLayoutCaption(node.children[i])).html());
                                                if(tabLayout.split === undefined && tabLayout.icon !== undefined) {
                                                    title.children('.ng-docker-icon').append(icons[tabLayout.id]);
                                                } else {
                                                    title.children('.ng-docker-icon').remove();
                                                }
                                                if(interactive) {
                                                    tab.children('.ng-docker-close').click(function() {
                                                        removeSplitChild(node, i);
                                                        $scope.$digest();
                                                    });
                                                    dragListeners[dragId++] = {
                                                        element: tab,
                                                        priority: 1,
                                                        threshold: headerDragThreshold,
                                                        dragHandler: function(e) {
                                                            beginFloating(e, node.children[i]);
                                                        }
                                                    };
                                                }
                                                if(i === node.activeTabIndex) {
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
                                                        beginFloating(e, node);
                                                    }
                                                };
                                            }
                                            var activeChild = node.children[node.activeTabIndex];
                                            if(activeChild.split !== undefined) {
                                                construct(node.children[node.activeTabIndex], element.children('.ng-docker-contents'), interactive);
                                            } else {
                                                panels[activeChild.id].appendTo(element.children('.ng-docker-contents'));
                                            }
                                        }
                                        break;
                                    default:
                                        ngDockerInternal.validationFail();
                                }
                                element.data('ngDockerNode', node);
                                element.appendTo(parent);
                            } else {
                                var panel = panels[node.id];
                                var panelContainer = jQuery(panelContainerHTML);
                                var header = panelContainer.children('.ng-docker-header');
                                var title = header.children('.ng-docker-title');
                                title.children('.ng-docker-icon').after(jQuery('<div></div>').text(ngDockerInternal.computeLayoutCaption(node)).html());
                                if(node.icon !== undefined) {
                                    title.children('.ng-docker-icon').append(icons[node.id]);
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
                                            beginFloating(e, node);
                                        }
                                    };
                                }
                                panelContainer.appendTo(parent);
                            }
                        };
                        // construct container for layout elements
                        if(root !== null) {
                            var allContainer = jQuery(allContainerHTML);
                            construct(root, allContainer, true);
                            if(root.split === undefined) {
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
                                    var element = findDropVisualParentElement(target.node);
                                    if(element === null) {
                                        throw new Error('Failed to find element for node', target.node);
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
                                            if(target.node.split !== undefined) {
                                                if(target.node.split !== 'tabs') {
                                                    throw new Error('Expected tabs split');
                                                }
                                                var tabNav = findNodeHeaderElement(target.node);
                                                var tabVisual = jQuery(dropVisualTabHTML);
                                                if(target.tabIndex === 0) {
                                                    tabNav.prepend(tabVisual)
                                                } else {
                                                    jQuery(tabNav.children('.ng-docker-tab')[target.tabIndex-1]).after(tabVisual);
                                                }
                                                var futureLayout = ngDockerUtil.cloneLayout(target.node);
                                                futureLayout.children.splice(target.tabIndex, 0, floatingState.layout);
                                                tabNav.children().each(function(index) {
                                                    jQuery(this).css('width', computeTabWidth(futureLayout, tabNav.width(), index));
                                                });
                                                visual = null;
                                            } else {
                                                var header = findNodeHeaderElement(target.node);
                                                visual = jQuery(dropVisualTabOnPanelHTML);
                                                var futureLayout = {
                                                    split: 'tabs',
                                                    activeTabIndex: 1,
                                                    children: [
                                                        target.node,
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
                                            ngDockerInternal.validationFail();
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
        if(root.data !== undefined && typeof root.data !== 'object') {
            throw new Error('data must be an object');
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
            if(root.caption === undefined) {
                throw new Error('caption must be defined for a panel');
            }
            if(typeof root.caption !== 'string') {
                throw new Error('caption must be a string');
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
        var seenIds = {};
        this.findLeaves(root).forEach(function(root) {
            if(seenIds[root.id]) {
                throw new Error('Duplicate panel id \'' + root.id + '\'');
            } else {
                seenIds[root.id] = true;
            }
        });
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
                result.caption = root.caption;
                result.panel = this.cloneTemplate(root.panel);
                if(root.icon !== undefined) {
                    result.icon = this.cloneTemplate(root.icon);
                }
            }
            result.gravity = root.gravity;
            result.group = root.group;
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

    this.computeLayoutCaption = function(root) {
        if(root.split !== undefined) {
            return root.children.map(this.computeLayoutCaption.bind(this)).join(', ');
        } else {
            return root.caption;
        }
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

    this.validationFail = function() {
        throw new Error('This case was supposed to be rejected by input validation');
    };
}]);
