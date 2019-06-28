/*
 * Copyright 2018 Opus Logica
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

angular.module('ngPaneManager', [])
.service('ngPaneManager', ['ngPaneManagerInternal', function(ngPaneManagerInternal) {
    /**
     * This is the contents of the <code>ngPaneManager</code> service, which contains various auxiliary functions for working with ngPaneManager layouts and configurations.
     *
     * @example <caption>Example of how to use the service:</caption>
     * app.controller('SomePanelController', function($scope, ngPaneManager) {
     *   $scope.config = {
     *     layout: {
     *       id: 'some-panel',
     *       title: 'Some Panel',
     *       panel: {
     *         template: '<div>I am some panel!</div>'
     *       }
     *     }
     *   };
     *   $scope.config.layout = ngPaneManager.removeLeafWithId($scope.config.layout, 'some-panel');
     * });
     *
     * @namespace ngPaneManager
     */

    var that = this;

    // NOTE: When you add configuration options here, be sure to update ngPaneManagerInternal's cloneConfig, configsEqual, and derefConfig
    this.DEFAULT_CONFIG = {
        headerHeight: 20,
        borderWidth: 2,
        marginWidth: 20,
        getterSetter: false,
        closeButton: {
            template: '<span style="position: relative; font-size: 16px;">&#x2A09;</span>'
        },
        tabNavAddButtonEnabled: false,
        tabNavAddButtonHandler: function(node) {
            // do nothing by default
            return null;
        },
        tabNavAddButton: {
            template: '<span style="position: relative; font-size: 16px;">&#xFF0B;</span>',
        },
        refs: {},
        layout: null
    };

    /**
     * Finds all the leaf nodes in a layout.
     *
     * @memberof ngPaneManager
     * @param {object} root The node in the layout from which to find leaves.
     * @returns {Array} An array of leaf nodes from the given layout. 
     *
     * @example
     * var layout = {
     *   split: 'vertical',
     *   ratio: 0.5,
     *   children: [
     *     {
     *       split: 'horizontal',
     *       ratio: 0.5,
     *       children: [
     *         {
     *           id: 'panel-1',
     *           title: 'Panel 1',
     *           panel: {
     *             template: '<div>I am panel 1.</div>'
     *           }
     *         },
     *         {
     *           id: 'panel-2',
     *           title: 'Panel 2',
     *           panel: {
     *             template: '<div>I am panel 2.</div>'
     *           }
     *         }
     *       ]
     *     },
     *     {
     *       id: 'panel-3',
     *       title: 'Panel 3',
     *       panel: {
     *         template: '<div>I am panel 3.</div>'
     *       }
     *     }
     *   ]
     * };
     * var leaves = ngPaneManager.findLeaves(layout); // leaves is an array containing nodes 'panel-1', 'panel-2', 'panel-3'
     */
    this.findLeaves = function(root) {
        return ngPaneManagerInternal.findLeaves(root);
    };

    /**
     * Finds the leaf node in a layout with the given ID.
     *
     * @memberof ngPaneManager
     * @param {object} root The root node of the layout.
     * @param {string} id The ID of the leaf to find.
     * @return {object} If found, the leaf node with the given ID, otherwise null.
     *
     * @example
     * var layout = {
     *   split: 'vertical',
     *   ratio: 0.5,
     *   children: [
     *     {
     *       split: 'horizontal',
     *       ratio: 0.5,
     *       children: [
     *         {
     *           id: 'panel-1',
     *           title: 'Panel 1',
     *           panel: {
     *             template: '<div>I am panel 1.</div>'
     *           }
     *         },
     *         {
     *           id: 'panel-2',
     *           title: 'Panel 2',
     *           panel: {
     *             template: '<div>I am panel 2.</div>'
     *           }
     *         }
     *       ]
     *     },
     *     {
     *       id: 'panel-3',
     *       title: 'Panel 3',
     *       panel: {
     *         template: '<div>I am panel 3.</div>'
     *       }
     *     }
     *   ]
     * };
     * var leaf = ngPaneManager.findLeafWithId(layout, 'panel-2'); // returns the second child of the horizontal split
     * var notfound = ngPaneManager.findLeafWithId(layout, 'nope'); // returns null
     */
    this.findLeafWithId = function(root, id) {
        return ngPaneManagerInternal.findLeafWithId(root, id);
    };

    /**
     * Inserts a leaf node into the layout. <code>leaf</code> must have a <code>gravity</code> property on it, and all existing leaves
     * in the given layout must have <code>gravity</code> defined as well. <b>Set your layout to the return value of this function</b>.
     *
     * Insertion currently supports four kinds of <code>gravity</code>: <code>left</code>, <code>center</code>, <code>right</code>, <code>bottom</code>.
     * The algorithm tries to recognize where the "left", "center", "right", and "bottom" parts of the layout are. If the panel has left
     * gravity, then it is placed in the left region of the layout (either with a vertical split, if there is no left region, or 
     * with a tab split). For center gravity, the center region of the layout is identified, and the leaf is inserted either with a 
     * vertical split or a tab split. For right gravity, the right region of the layout is identified, and the leaf is inserted either with a
     * vertical split or a tab split. For bottom gravity, the bottom region of the layout is identified, and the leaf is inserted either with a
     * horizontal split or a tab split.
     *
     * If you want certain leaf nodes to always form a tab split (regardless of gravity), you can use the optional <code>group</code> property. 
     * When <code>insertLeaf</code> is called, it will first check if <code>leaf</code> has a <code>group</code> property. If it does, it will 
     * search the layout for other nodes with the same <code>group</code>: if it finds another node with the same group, it will form a tab 
     * split with that node instead of splitting by gravity.
     *
     * See {@link https://sashavol.com/misc/ngPaneManager/test/3.htm the test page 3.htm} for an interactive demo of how insertLeaf works.
     *
     * @memberof ngPaneManager
     * @param {object} root The root node of the layout.
     * @param {object} leaf The leaf to insert.
     * @param {Number} ratio The ratio of the leaf in its split (only used if a vertical split is created).
     * @returns {object} The new root of the layout.
     *
     * @example
     * $scope.config = {
     *   layout: {
     *     id: 'center-panel',
     *     title: 'Center Panel',
     *     panel: {
     *       template: '<div>I want to be in the center!</div>'
     *     },
     *     gravity: 'center'
     *   }
     * };
     * var leftLeaf = {
     *   id: 'left-panel',
     *   title: 'Left Panel',
     *   panel: {
     *     template: '<div>I want to be at the left!</div>'
     *   },
     *   gravity: 'left'
     * };
     * // After this, $scope.config.layout will be
     * // {
     * //   split: 'vertical',
     * //   ratio: 0.5,
     * //   children: [
     * //     {
     * //       id: 'left-panel',
     * //       title: 'Left Panel',
     * //       panel: {
     * //         template: '<div>I want to be at the left!</div>'
     * //       },
     * //       gravity: 'left'
     * //     },
     * //     {
     * //       id: 'center-panel',
     * //       title: 'Center Panel',
     * //       panel: {
     * //         template: '<div>I want to be in the center!</div>'
     * //       }
     * //     }
     * //   ]
     * // }
     * $scope.config.layout = ngPaneManager.insertLeaf($scope.config.layout, leftLeaf, 0.5);
     */
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
            var r = ngPaneManagerInternal.matchLayoutPattern(root);
            var gravity = ngPaneManagerInternal.computeLayoutGravity(leaf);
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
                var insertStrategy = ngPaneManagerInternal.findInsertStrategy(r.match, leaf);
                var layoutToSplit = insertStrategy.node(r.node);
                var p = this.findParent(root, layoutToSplit);
                var split = {
                    split: insertStrategy.split,
                    ratio: insertStrategy.index === 0 ? ratio : 1 - ratio,
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

    /**
     * Removes the leaf with the specified ID from the layout. <b>Set your layout to the return value of this function</b>
     *
     * @memberof ngPaneManager
     * @param {object} root The root node of the layout.
     * @param {string} id The ID of the leaf node to remove.
     * @returns {object} The new root node.
     */
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

    /**
     * Finds the parent of a node in a layout.
     *
     * @memberof ngPaneManager
     * @param {object} root The root node of the layout.
     * @param {object} node The node for which to find the parent.
     * @returns {object} The parent of the node, or null if <code>node</code> is the root node and has no parent.
     */
    this.findParent = function(root, node) {
        return ngPaneManagerInternal.findParent(root, node);
    };

    /**
     * Gets the node at the given path.
     *
     * @param {object} root The root node of the layout.
     * @param {object} node The node to compute the path for.
     * @returns {object} The node at the given path.
     */
    this.getNodeAtPath = function(root, path) {
        var node = root;
        for(var i = 0; i !== path.length; ++i) {
            node = node.children[path[i]];
            if(node === undefined) {
                throw new Error('invalid path');
            }
        }
        return node;
    };

    /**
     * Computes the path to the node.
     *
     * @return {Array<Number>} Path to the node, or null if the node cannot be found
     */
    this.computeNodePath = function(root, node) {
        var f = function(currentNode, path) {
            if(currentNode === node) {
                return path;
            } else if(currentNode.split !== undefined) {
                for(var i = 0; i !== currentNode.children.length; ++i) {
                    var r = f(currentNode.children[i], path.concat([i]));
                    if(r !== null) {
                        return r;
                    }
                }
                return null;
            } else {
                return null;
            }
        };
        return f(root, []);
    };

    /**
     * Removes the child of a split. <b>Set your layout to the return value of this function.</b>
     *
     * @memberof ngPaneManager
     * @param {object} root The root node of the layout.
     * @param {object} node The split from which to remove the child.
     * @param {Number} index The index of the child to remove.
     * @returns {object} The new root node.
     *
     * @example
     * $scope.config = {
     *   layout: {
     *     split: 'vertical',
     *     ratio: 0.5,
     *     children: [
     *       {
     *         id: 'panel-1',
     *         title: 'Panel 1',
     *         panel: {
     *           template: '<div>I am panel 1</div>'
     *         }
     *       },
     *       {
     *         id: 'panel-2',
     *         title: 'Panel 2',
     *         panel: {
     *           template: '<div>I am panel 2</div>'
     *         }
     *       }
     *     ]
     *   } 
     * };
     *
     * // After this, $scope.config.layout will be
     * // {
     * //   id: 'panel-2',
     * //   title: 'Panel 2',
     * //   panel: {
     * //     template: '<div>I am panel 2</div>'
     * //   }
     * // }
     * $scope.config.layout = ngPaneManager.removeSplitChild($scope.config.layout, $scope.config.layout, 0);
     */
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
                ngPaneManagerInternal.validationFail();
            }
        }
        return root;
    };

    /**
     * Removes a node from the layout. <b>Set your layout to the return value of this function.</b>
     *
     * @memberof ngPaneManager
     * @param {object} root The root node of the layout.
     * @param {object} node The node to remove.
     * @returns {object} The new root node. 
     */
    this.removeNode = function(root, node) {
        var p = this.findParent(root, node);
        if(p === null) {
            root = null;
        } else {
            root = this.removeSplitChild(root, p[0], p[1]);
        }
        return root;
    };

    /**
     * Sets activeTabIndex on all the ancestors of the given node such that the node is visible. This is useful if you want to "focus" onto a panel that may be concealed behind tab splits.
     *
     * @memberof ngPaneManager
     * @param {object} root The root node of the layout.
     * @param {object} node The node to reveal.
     */
    this.revealNode = function(root, node) {
        var p = this.findParent(root, node);
        while(p !== null) {
            if(p[0].split === 'tabs') {
                p[0].activeTabIndex = p[1];
            }
            p = this.findParent(root, p[0]);
        }
    };

    /**
     * Creates a copy of a layout.
     *
     * @memberof ngPaneManager
     * @param {object} root The node in the layout to clone.
     * @returns {object} A copy of the layout.
     */
    this.cloneLayout = function(root) {
        return ngPaneManagerInternal.cloneLayout(root);
    };

    /**
     * Tests if two layouts are equal.
     *
     * @memberof ngPaneManager
     * @param {object} a The first layout.
     * @param {object} b The second layout.
     * @returns {boolean} Whether the two layouts are equal.
     */
    this.layoutsEqual = function(a, b) {
        return ngPaneManagerInternal.layoutsEqual(a, b);
    };

    /**
     * Performs syntax validity checks on the layout (the validity of templates and templateUrls is not checked, however). ngPaneManager automatically call this function when processing the layout, normally you do not need to call it.
     *
     * @memberof ngPaneManager
     * @param {object} root The node in the layout from which to perform validation.
     * @throws {Error} Error describing the problem with the layout.
     */
    this.validateLayout = function(root) {
        return ngPaneManagerInternal.validateLayout(root);
    };

    /**
     * Clones a config object.
     *
     * @memberof ngPaneManager
     * @param {object} config The config to clone.
     * @returns {object} A copy of the config object.
     */
    this.cloneConfig = function(config) {
        return ngPaneManagerInternal.cloneConfig(config);
    };

    /**
     * Tests if two config objects are equal.
     *
     * @memberof ngPaneManager
     * @param {object} a The first config object.
     * @param {object} b The second config object.
     * @returns {boolean} Whether the two config objects are equal.
     */
    this.configsEqual = function(a, b) {
        return ngPaneManagerInternal.configsEqual(a, b);
    };

    /**
     * Creates a reference to a value in the config's <code>refs</code> property.
     * This function is used to make the layout serializable (e.g. if your application needs to be able to store the panel state in a cookie or local storage). It is <i>not</i> required to use refs for general use (only if you want serializability).
     *
     * @example
     * // Example of using a ref in a layout
     * $scope.config = {
     *   refs: {
     *     SomePanelController: function($scope) {
     *       $scope.something = 'Hello!';
     *     }
     *   },
     *   layout: {
     *     id: 'some-panel',
     *     title: 'Some Panel',
     *     panel: {
     *       template: '<div>{{something}}</div>',
     *       controller: ngPaneManager.ref('SomePanelController')
     *     }
     *   }
     * };
     *
     * @memberof ngPaneManager
     * @param {string} name The name of the ref.
     * @returns {string} A placeholder string that will be expanded by ngPaneManager to the value given in the config's <code>refs</code> property.
     */
    this.ref = function(name) {
        return ngPaneManagerInternal.ref(name);
    };

    /**
     * Determines whether a value is a ref.
     *
     * @memberof ngPaneManager
     * @param {*} x The value to check.
     * @returns {boolean} Whether <code>x</code> is a ref.
     *
     * @example
     * var x = ngPaneManager.ref('test');
     * var y = 5;
     * ngPaneManager.isRef(x); // returns true
     * ngPaneManager.isRef(y); // returns false
     */
    this.isRef = function(x) {
        return ngPaneManagerInternal.isRef(x);
    };

    /**
     * Expands a ref to the value it refers to in the config's <code>refs</code> property.
     *
     * @memberof ngPaneManager
     * @param {*} x The value to dereference.
     * @param {object} config The configuration object.
     * @returns {string} If the value is a reference, the corresponding value in the config's <code>refs</code> property. Otherwise, just returns <code>x</code>.
     *
     * @example
     * var config = {
     *   refs: {
     *     test: function x() {
     *       console.log('Hello World!');
     *     }
     *   }
     * };
     * var ref = ngPaneManager.ref('test');
     * var f = ngPaneManager.deref(ref, config);
     * f(); // prints "Hello World!"
     * var num = ngPaneManager.deref(5, config); // 5 is not a ref, so deref just returns it
     */
    this.deref = function(x, config) {
        return ngPaneManagerInternal.deref(x, config);
    };

    /**
     * Deref all refs in a layout.
     *
     * @memberof ngPaneManager
     * @param {object} root The node in the layout from which to deref.
     * @param {object} config The config object.
     */
    this.derefLayout = function(root, config) {
        return ngPaneManagerInternal.derefLayout(root, config);
    };

    /**
     * Derefs all refs in a config object.
     *
     * @memberof ngPaneManager
     * @param {object} config The config to deref.
     */
    this.derefConfig = function(config) {
        return ngPaneManagerInternal.derefConfig(config);
    };
}])
.directive('ngPaneManager', ['$parse', '$compile', '$templateCache', '$templateRequest', '$q', '$exceptionHandler', '$controller', '$injector', 'ngPaneManager', 'ngPaneManagerInternal', function($parse, $compile, $templateCache, $templateRequest, $q, $exceptionHandler, $controller, $injector, ngPaneManager, ngPaneManagerInternal) {
    return {
        restrict: 'A',
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
                '<div class="ng-pane-manager-container"></div>';

            var floatingContainerHTML =
                '<div class="ng-pane-manager-floating-container"></div>';

            var panelContainerHTML =
                '<div class="ng-pane-manager-panel-container">' +
                '   <div class="ng-pane-manager-header">' +
                '       <div class="ng-pane-manager-title">' +
                '           <div class="ng-pane-manager-icon"></div>' +
                '           <div class="ng-pane-manager-title-text"></div>' +
                '       </div>' +
                '       <div class="ng-pane-manager-close"></div>' +
                '   </div>' +
                '   <div class="ng-pane-manager-contents"></div>' +
                '</div>';

            // simulates the appearance of a tab split for when the panel has alwaysTab set 
            // but is not currently in a tab split
            var panelContainerPseudoTabHTML =
                '<div class="ng-pane-manager-panel-container">' +
                '   <div class="ng-pane-manager-tab-nav">' +
                '       <div class="ng-pane-manager-tab ng-pane-manager-tab-active">' +
                '           <div class="ng-pane-manager-title">' +
                '               <div class="ng-pane-manager-icon"></div>' +
                '               <div class="ng-pane-manager-title-text"></div>' +
                '           </div>' +
                '           <div class="ng-pane-manager-close"></div>' +
                '       </div>' +
                '   </div>' +
                '   <div class="ng-pane-manager-contents"></div>' +
                '</div>';

            var vsplitHTML =
                '<div class="ng-pane-manager-vsplit">' +
                '   <div class="ng-pane-manager-left"></div>' +
                '   <div class="ng-pane-manager-separator ng-pane-manager-border ng-pane-manager-vertical-border"></div>' +
                '   <div class="ng-pane-manager-right"></div>' +
                '</div>';

            var hsplitHTML =
                '<div class="ng-pane-manager-hsplit">' +
                '   <div class="ng-pane-manager-top"></div>' +
                '   <div class="ng-pane-manager-separator ng-pane-manager-border-invisible ng-pane-manager-horizontal-border"></div>' +
                '   <div class="ng-pane-manager-bottom"></div>' +
                '</div>';

            var tabsplitHTML =
                '<div class="ng-pane-manager-tabsplit">' +
                '   <div class="ng-pane-manager-tab-nav">' +
                '   </div>' +
                '   <div class="ng-pane-manager-contents"></div>' +
                '</div>';

            var tabNavBorderHTML = '<div class="ng-pane-manager-border ng-pane-manager-tab-nav-border"></div>';

            var tabHTML =
                '<div class="ng-pane-manager-tab">' +
                '   <div class="ng-pane-manager-title">' +
                '       <div class="ng-pane-manager-icon"></div>' +
                '       <div class="ng-pane-manager-title-text"></div>' +
                '   </div>' +
                '   <div class="ng-pane-manager-close"></div>' +
                '</div>';

            var hiddenHTML =
                '<div class="ng-pane-manager-hidden"></div>';

            var dropVisualTopHTML =
                '<div class="ng-pane-manager-drop-visual ng-pane-manager-abs-drop-visual ng-pane-manager-drop-visual-top"></div>';

            var dropVisualRightHTML =
                '<div class="ng-pane-manager-drop-visual ng-pane-manager-abs-drop-visual ng-pane-manager-drop-visual-right"></div>';

            var dropVisualBottomHTML =
                '<div class="ng-pane-manager-drop-visual ng-pane-manager-abs-drop-visual ng-pane-manager-drop-visual-bottom"></div>';

            var dropVisualLeftHTML =
                '<div class="ng-pane-manager-drop-visual ng-pane-manager-abs-drop-visual ng-pane-manager-drop-visual-left"></div>';

            var dropVisualWholeHTML =
                '<div class="ng-pane-manager-drop-visual ng-pane-manager-abs-drop-visual ng-pane-manager-drop-visual-whole"><div>';

            var dropVisualTabHTML =
                '<div class="ng-pane-manager-drop-visual ng-pane-manager-drop-visual-tab"></div>';

            var dropVisualTabOnPanelHTML =
                '<div class="ng-pane-manager-drop-visual ng-pane-manager-drop-visual-tab-on-panel"></div>';

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
                        var val = ngPaneManager.deref(template.resolve[k], that._config);
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
                ngPaneManagerInternal.validationFail();
            };

            var cloneFloatingState = function(floatingState) {
                if(floatingState === null) {
                    return null;
                } else {
                    return {
                        layout: ngPaneManager.cloneLayout(floatingState.layout),
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
                    if(!ngPaneManager.layoutsEqual(a.layout, b.layout)) {
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

            var configGetRaw = $parse($attr.ngPaneManager);
            var configGet = function() {
                var raw = configGetRaw($scope);
                if(typeof raw !== 'object') {
                    throw new Error('ng-pane-manager must refer to an object');
                }
                return angular.extend({}, ngPaneManager.DEFAULT_CONFIG, raw);
            };

            var layoutGet = function() {
                var config = configGet();
                if(config.getterSetter) {
                    return config.layout();
                } else {
                    return config.layout;
                }
            };
            var layoutSet = function(val) {
                var config = configGet();
                if(config.getterSetter) {
                    config.layout(val);
                } else {
                    var rawConfig = configGetRaw($scope);
                    rawConfig.layout = val;
                }
            };

            var findParent = function(node) {
                var p = ngPaneManager.findParent(layoutGet(), node);
                if(p === undefined) {
                    throw new Error('Failed to find node');
                } else {
                    return p;
                }
            };

            // returns the DOM element whose ngPaneManagerNode == layout, or null if no such element exists
            var findElementWithNode = function(node) {
                var f = function(element) {
                    var elementNode = element.data('ngPaneManagerNode');
                    if(elementNode !== undefined && ngPaneManager.layoutsEqual(elementNode, node)) {
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
                return f(ngPaneManagerInternal.childrenWithClass($element, 'ng-pane-manager-container'));
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
                            // panel is wrapped in panelContainerHTML, provide .ng-pane-manager-panel-container
                            return panel.parent().parent();
                        } else {
                            // panel is wrapped inside a tabsplitHTML, provide .ng-pane-manager-contents
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
                                    return ngPaneManagerInternal.childrenWithClass(element, 'ng-pane-manager-tab-nav');
                                } else {
                                    return null;
                                }
                            }
                            break;
                        default:
                            ngPaneManagerInternal.validationFail();
                    }
                } else {
                    var panel = panels[node.id];
                    if(panel !== undefined && panel.parent().length > 0) {
                        var p = findParent(node);
                        if(p === null || p[0].split !== 'tabs') {
                            if(node.alwaysTab) {
                                // panel is wrapped in panelContainerPseudoTabHTML, provide .ng-pane-manager-tab-nav.
                                return ngPaneManagerInternal.childrenWithClass(panel.parent().parent(), 'ng-pane-manager-tab-nav');
                            } else {
                                // panel is wrapped in panelContainerHTML, provide .ng-pane-manager-header
                                return ngPaneManagerInternal.childrenWithClass(panel.parent().parent(), 'ng-pane-manager-header');
                            }
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
                    layoutSet(replacement);
                } else {
                    p[0].children[p[1]] = replacement;
                    layoutSet(layoutGet());
                }
            };

            var removeSplitChild = function(node, index) {
                layoutSet(ngPaneManager.removeSplitChild(layoutGet(), node, index));
            };

            var removeLeafWithId = function(id) {
                layoutSet(ngPaneManager.removeLeafWithId(layoutGet(), id));
            };

            var removeNode = function(node) {
                layoutSet(ngPaneManager.removeNode(layoutGet(), node));
            };

            // get the angular template string from a template
            var getTemplateTemplateString = function(template) {
                return template.templateUrl ? $templateCache.get(template.templateUrl) : template.template;
            }

            var newTemplateScope = function(template) {
                var scope = $scope.$new();
                if(template.scope !== undefined) {
                    var config = configGet();
                    Object.keys(template.scope).forEach(function(k) {
                        scope[k] = ngPaneManager.deref(template.scope[k], config);
                    });
                }
                return scope;
            };

            var maybeLoadTemplateController = function(template, scope, element) {
                if(template.controller !== undefined) {
                    var config = configGet();
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
                    var controller = ngPaneManager.deref(template.controller, config);
                    element.data('$ngPaneManagerPanelController', $controller(controller, locals));
                }
            };

            var computeDropSplitWhere = function(element) {
                var offs = ngPaneManagerInternal.elementOffset(element);
                var x = floatingState.cursorPosition.pageX - offs.left;
                var y = floatingState.cursorPosition.pageY - offs.top;
                var w = ngPaneManagerInternal.elementWidth(element);
                var h = ngPaneManagerInternal.elementHeight(element);
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
                var root = layoutGet();
                if(root === null) {
                    // drop as root
                    return {
                        where: 'whole',
                        node: null
                    };
                } else {
                    // check panels (for vertical/horizontal split)
                    {
                        var panelIds = ngPaneManager.findLeaves(root).map(function(l) {
                            return l.id;
                        });
                        for(var i = 0; i !== panelIds.length; ++i) {
                            var panel = panels[panelIds[i]];
                            var container = panel.parent();
                            if(container.length > 0) {
                                var containerOffs = ngPaneManagerInternal.elementOffset(container);
                                if(floatingState.cursorPosition.pageX >= containerOffs.left && floatingState.cursorPosition.pageX < containerOffs.left + ngPaneManagerInternal.elementWidth(container)
                                    && floatingState.cursorPosition.pageY >= containerOffs.top && floatingState.cursorPosition.pageY < containerOffs.top + ngPaneManagerInternal.elementHeight(container))
                                {
                                    return {
                                        where: computeDropSplitWhere(container),
                                        node: panel.data('ngPaneManagerNode')
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
                                    var headerOffs = ngPaneManagerInternal.elementOffset(header);
                                    if(floatingState.cursorPosition.pageX >= headerOffs.left && floatingState.cursorPosition.pageX < headerOffs.left + ngPaneManagerInternal.elementWidth(header)
                                        && floatingState.cursorPosition.pageY >= headerOffs.top && floatingState.cursorPosition.pageY < headerOffs.top + ngPaneManagerInternal.elementHeight(header))
                                    {
                                        var tabs = ngPaneManagerInternal.childrenWithClass(header, 'ng-pane-manager-tab');
                                        for(var i = 0; i !== tabs.length; ++i) {
                                            var tab = angular.element(tabs[i]);
                                            var tabOffs = ngPaneManagerInternal.elementOffset(tab);
                                            if(floatingState.cursorPosition.pageX >= tabOffs.left && floatingState.cursorPosition.pageX < tabOffs.left + ngPaneManagerInternal.elementWidth(tab)
                                                && floatingState.cursorPosition.pageY >= tabOffs.top && floatingState.cursorPosition.pageY < tabOffs.top + ngPaneManagerInternal.elementHeight(tab))
                                            {
                                                var tabIndex;
                                                if(floatingState.cursorPosition.pageX < tabOffs.left + ngPaneManagerInternal.elementWidth(tab)/2) {
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
                                    var headerOffs = ngPaneManagerInternal.elementOffset(header);
                                    if(floatingState.cursorPosition.pageX >= headerOffs.left && floatingState.cursorPosition.pageX < headerOffs.left + ngPaneManagerInternal.elementWidth(header)
                                        && floatingState.cursorPosition.pageY >= headerOffs.top && floatingState.cursorPosition.pageY < headerOffs.top + ngPaneManagerInternal.elementHeight(header))
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
                        layoutSet(floatingState.layout);
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

                // update widths for all tab splits
                var tabsplits = angular.element(container[0].querySelectorAll('.ng-pane-manager-tabsplit'));
                for(var i = 0; i !== tabsplits.length; ++i) {
                    var tabsplit = angular.element(tabsplits[i]);
                    var tabNav = ngPaneManagerInternal.childrenWithClass(tabsplit, 'ng-pane-manager-tab-nav');
                    var node = tabsplit.data('ngPaneManagerNode');
                    var tabs = ngPaneManagerInternal.childrenWithClass(tabNav, 'ng-pane-manager-tab'); 
                    for(var j = 0; j !== tabs.length; ++j) {
                        var tab = angular.element(tabs[j]);
                        tab.css('width', computeTabWidth(node, ngPaneManagerInternal.elementWidth(tabNav), j) + 'px');
                    }
                }

                // update widths for fake tab splits
                var fakeNavs = angular.element(container[0].querySelectorAll('.ng-pane-manager-panel-container > .ng-pane-manager-tab-nav'));
                for(var i = 0; i !== fakeNavs.length; ++i) {
                    var tabNav = angular.element(fakeNavs[i]);
                    var headerWidth = ngPaneManagerInternal.elementWidth(tabNav);
                    var tab = ngPaneManagerInternal.childrenWithClass(tabNav, 'ng-pane-manager-tab');
                    var w = headerWidth - tabNavRightPadding;
                    tab.css('width', Math.min(Math.min(initialTabWidth, w), headerWidth - tabNavRightPadding) + 'px');
                }
            };

            var clearDropTargetVisuals = function() {
                angular.element($element[0].querySelectorAll('.ng-pane-manager-drop-visual')).remove();
                updateContainerTabWidths(angular.element($element[0].querySelectorAll('.ng-pane-manager-container')));
                updateContainerTabWidths(angular.element($element[0].querySelectorAll('.ng-pane-manager-floating-container')));
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
                        ngPaneManagerInternal.validationFail();
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
                        var elOffs = ngPaneManagerInternal.elementOffset(el);
                        if(info.pageX >= elOffs.left && info.pageY >= elOffs.top
                            && info.pageX < elOffs.left + ngPaneManagerInternal.elementWidth(el) && info.pageY < elOffs.top + ngPaneManagerInternal.elementHeight(el))
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

                var layout = layoutGet();
                var config = configGet();
                var configCopy = ngPaneManager.cloneConfig(config);

                var leaves =  [];
                if(layout !== null) {
                    ngPaneManager.validateLayout(layout);
                    Array.prototype.push.apply(leaves, ngPaneManager.findLeaves(layout));
                }
                if(floatingState !== null) {
                    ngPaneManager.validateLayout(floatingState.layout);
                    Array.prototype.push.apply(leaves, ngPaneManager.findLeaves(floatingState.layout));
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
                        var tryAdapt = function(m, leavesById, adaptingIcons) {
                            var next = {};
                            Object.keys(m).forEach(function(k) {
                                var el = m[k];
                                var elNode = el.data('ngPaneManagerNode');
                                var elConfig = el.data('ngPaneManagerConfig');
                                var leaf = leavesById[elNode.id];
                                var destroy;
                                if(!leaf) {
                                    destroy = true;
                                } else {
                                    var nodeBefore = ngPaneManager.derefLayout(ngPaneManager.cloneLayout(elNode), elConfig);
                                    var nodeAfter = ngPaneManager.derefLayout(ngPaneManager.cloneLayout(leaf), config);
                                    var key = adaptingIcons ? 'icon' : 'panel';
                                    if(nodeBefore[key] && nodeAfter[key]) {
                                        destroy = !ngPaneManagerInternal.templatesEqual(nodeBefore[key], nodeAfter[key]);
                                    } else {
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
                        icons = tryAdapt(icons, leavesWithIconById, true);
                        panels = tryAdapt(panels, leavesById, false);
                    }

                    // construct any missing icons and panels
                    leaves.forEach(function(leaf) {
                        if(!panels[leaf.id]) {
                            var panelScope = newTemplateScope(leaf.panel);
                            var panel = $compile('<div class="ng-pane-manager-wrapper">' + getTemplateTemplateString(leaf.panel) + '</div>')(panelScope);
                            panelScope.closeThisPanel = function() {
                                removeLeafWithId(leaf.id);
                            };
                            panelScope.onPanelResize = function(listener) {
                                var listeners = panel.data('ngPaneManagerResizeListeners');
                                listeners.push(listener);
                            };
                            panelScope.offPanelResize = function(listener) {
                                var listeners = panel.data('ngPaneManagerResizeListeners');
                                var index = listeners.indexOf(listener);
                                if(index >= 0) {
                                    listeners.splice(index, 1);
                                }
                            };
                            panel.data('ngPaneManagerNode', ngPaneManager.cloneLayout(leaf));
                            panel.data('ngPaneManagerConfig', configCopy);
                            panel.data('ngPaneManagerResizeListeners', []);
                            maybeLoadTemplateController(leaf.panel, panelScope, panel);
                            panels[leaf.id] = panel;
                        }
                        if(leaf.icon !== undefined && !icons[leaf.id]) {
                            var iconScope = newTemplateScope(leaf.icon);
                            var icon = $compile('<div class="ng-pane-manager-wrapper">' + getTemplateTemplateString(leaf.icon) + '</div>')(iconScope);
                            icon.data('ngPaneManagerNode', ngPaneManager.cloneLayout(leaf));
                            icon.data('ngPaneManagerConfig', configCopy);
                            maybeLoadTemplateController(leaf.icon, iconScope, icon);
                            icons[leaf.id] = icon;
                        }
                    });

                    // update panel element data
                    Object.keys(panels).forEach(function(id) {
                        var panel = panels[id];
                        var leaf = ngPaneManager.findLeafWithId(layout, id);
                        if(leaf === null) {
                            leaf = ngPaneManager.findLeafWithId(floatingState.layout, id);
                            if(leaf === null) {
                                throw new Error('Failed to find panel with id \'' + id + '\'');
                            }
                        }
                        panel.data('ngPaneManagerNode', ngPaneManager.cloneLayout(leaf));
                        panel.data('ngPaneManagerConfig', configCopy);
                    });

                    // update icon element data
                    Object.keys(icons).forEach(function(id) {
                        var icon = icons[id];
                        var leaf = ngPaneManager.findLeafWithId(layout, id);
                        if(leaf === null) {
                            leaf = ngPaneManager.findLeafWithId(floatingState.layout, id);
                            if(leaf === null) {
                                throw new Error('Failed to find panel with id \'' + id + '\'');
                            }
                        }
                        icon.data('ngPaneManagerNode', ngPaneManager.cloneLayout(leaf));
                        icon.data('ngPaneManagerConfig', configCopy);
                    });

                    // clear drag listeners
                    dragListeners = {};

                    // clear the constructed DOM
                    ngPaneManagerInternal.childrenWithClass($element, 'ng-pane-manager-container').remove();
                    ngPaneManagerInternal.childrenWithClass($element, 'ng-pane-manager-floating-container').remove();
                    ngPaneManagerInternal.childrenWithClass($element, 'ng-pane-manager-drop-visual').remove();

                    // construct the new DOM
                    {
                        var dragId = 0;
                        var initCloseButton = function(closeElem) {
                            var scope = newTemplateScope(config.closeButton);
                            closeElem.append($compile(getTemplateTemplateString(config.closeButton))(scope));
                        };
                        var initTabNavAddElement = function(node, tabNav) {
                            var config = configGet();
                            if(!config.tabNavAddButtonEnabled) {
                                return;
                            }
                            var scope = newTemplateScope(config.tabNavAddButton);
                            var container = document.createElement('div');
                            container.classList.add('ng-pane-manager-tab-nav-add');
                            var elem = $compile(getTemplateTemplateString(config.tabNavAddButton))(scope);
                            elem.on('click', function() {
                                var newTabNode = config.tabNavAddButtonHandler(node);
                                if(newTabNode === null) {
                                    return;
                                }
                                if(node.split === 'tabs') {
                                    node.children.push(newTabNode);
                                    node.activeTabIndex = node.children.length - 1;
                                } else {
                                    replaceNode(node, {
                                        split: 'tabs',
                                        activeTabIndex: 1,
                                        children: [
                                            node,
                                            newTabNode
                                        ]
                                    });
                                }
                                $scope.$digest();
                            });
                            angular.element(container).append(elem);
                            tabNav.append(container);
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
                                                for(var p = ngPaneManager.findParent(root, node); p !== null; p = ngPaneManager.findParent(root, p[0])) {
                                                    if(p[0].split === 'vertical' && p[1] === 1) {
                                                        return false;
                                                    }
                                                }
                                                return true;
                                            });
                                            var needsRightBorder = (function() {
                                                // if none of this vsplit's ancestors are the first child of a vsplit this vsplit needs a right border
                                                for(var p = ngPaneManager.findParent(root, node); p !== null; p = ngPaneManager.findParent(root, p[0])) {
                                                    if(p[0].split === 'vertical' && p[1] === 0) {
                                                        return false;
                                                    }
                                                }
                                                return true;
                                            });
                                            if(needsLeftBorder()) {
                                                var borderLeft = angular.element('<div class="ng-pane-manager-border ng-pane-manager-vertical-border"></div>');
                                                borderLeft.css('top', config.headerHeight + 'px');
                                                borderLeft.css('width', config.borderWidth + 'px');
                                                borderLeft.css('left', '0');
                                                element.prepend(borderLeft);
                                            }
                                            if(needsRightBorder()) {
                                                var borderRight = angular.element('<div class="ng-pane-manager-border ng-pane-manager-vertical-border"></div>');
                                                borderRight.css('top', config.headerHeight + 'px');
                                                borderRight.css('width', config.borderWidth + 'px');
                                                borderRight.css('right', '0');
                                                element.append(borderRight);
                                            }
                                            var leftNode = node.children[0];
                                            var rightNode = node.children[1];
                                            var left = ngPaneManagerInternal.childrenWithClass(element, 'ng-pane-manager-left');
                                            var sep = ngPaneManagerInternal.childrenWithClass(element, 'ng-pane-manager-separator');
                                            var right = ngPaneManagerInternal.childrenWithClass(element, 'ng-pane-manager-right');
                                            sep.css('top', config.headerHeight + 'px');
                                            construct(root, leftNode, left, interactive);
                                            construct(root, rightNode, right, interactive);
                                            left.css('width', 100*node.ratio + '%');
                                            sep.css('left', 'calc(' + 100*node.ratio + '% - ' + config.borderWidth/2 + 'px)');
                                            sep.css('width', config.borderWidth + 'px');
                                            right.css('width', 100*(1 - node.ratio) + '%');
                                            if(interactive) {
                                                var close;
                                                var nodePath = ngPaneManager.computeNodePath(root, node);
                                                if(leftNode.split === undefined) {
                                                    if(leftNode.alwaysTab) {
                                                        close = ngPaneManagerInternal.childrenWithClass(ngPaneManagerInternal.childrenWithClass(ngPaneManagerInternal.childrenWithClass(left.children(), 'ng-pane-manager-tab-nav'), 'ng-pane-manager-tab'), 'ng-pane-manager-close');
                                                    } else {
                                                        close = ngPaneManagerInternal.childrenWithClass(ngPaneManagerInternal.childrenWithClass(left.children(), 'ng-pane-manager-header'), 'ng-pane-manager-close');
                                                    }
                                                    close.on('click', function() {
                                                        var node = ngPaneManager.getNodeAtPath(layoutGet(), nodePath);
                                                        removeSplitChild(node, 0);
                                                        $scope.$digest();
                                                    });
                                                }
                                                if(rightNode.split === undefined) {
                                                    if(rightNode.alwaysTab) {
                                                        close = ngPaneManagerInternal.childrenWithClass(ngPaneManagerInternal.childrenWithClass(ngPaneManagerInternal.childrenWithClass(right.children(), 'ng-pane-manager-tab-nav'), 'ng-pane-manager-tab'), 'ng-pane-manager-close');
                                                    } else {
                                                        close = ngPaneManagerInternal.childrenWithClass(ngPaneManagerInternal.childrenWithClass(right.children(), 'ng-pane-manager-header'), 'ng-pane-manager-close');
                                                    }
                                                    close.on('click', function() {
                                                        var node = ngPaneManager.getNodeAtPath(layoutGet(), nodePath);
                                                        removeSplitChild(node, 1);
                                                        $scope.$digest();
                                                    });
                                                }
                                                dragListeners[dragId++] = {
                                                    element: sep,
                                                    priority: 1,
                                                    dragHandler: function(info) {
                                                        var node = ngPaneManager.getNodeAtPath(layoutGet(), nodePath);
                                                        var elOffs = ngPaneManagerInternal.elementOffset(element);
                                                        node.ratio = Math.max(0, Math.min(1, (info.pageX - elOffs.left)/ngPaneManagerInternal.elementWidth(element)));
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
                                                for(var p = ngPaneManager.findParent(root, node); p !== null; p = ngPaneManager.findParent(root, p[0])) {
                                                    if(p[0].split === 'horizontal' && p[1] === 0) {
                                                        return false;
                                                    }
                                                }
                                                return true;
                                            });
                                            if(needsBottomBorder()) {
                                                var borderBottom = angular.element('<div class="ng-pane-manager-border ng-pane-manager-horizontal-border"></div>');
                                                borderBottom.css('height', config.borderWidth + 'px');
                                                borderBottom.css('bottom', '0');
                                                element.append(borderBottom);
                                            }
                                            var topNode = node.children[0];
                                            var bottomNode = node.children[1];
                                            var top = ngPaneManagerInternal.childrenWithClass(element, 'ng-pane-manager-top'); 
                                            var sep = ngPaneManagerInternal.childrenWithClass(element, 'ng-pane-manager-separator'); 
                                            var bottom = ngPaneManagerInternal.childrenWithClass(element, 'ng-pane-manager-bottom');
                                            construct(root, topNode, top, interactive);
                                            construct(root, bottomNode, bottom, interactive);
                                            top.css('height', 100*node.ratio + '%');
                                            sep.css('top', 'calc(' + 100*node.ratio + '% - ' + config.borderWidth/2 + 'px)');
                                            sep.css('height', config.borderWidth + 'px');
                                            bottom.css('height', 100*(1-node.ratio) + '%');
                                            if(interactive) {
                                                var close;
                                                var nodePath = ngPaneManager.computeNodePath(root, node);
                                                if(topNode.split === undefined) {
                                                    if(topNode.alwaysTab) {
                                                        close = ngPaneManagerInternal.childrenWithClass(ngPaneManagerInternal.childrenWithClass(ngPaneManagerInternal.childrenWithClass(top.children(), 'ng-pane-manager-tab-nav'), 'ng-pane-manager-tab'), 'ng-pane-manager-close');
                                                    } else {
                                                        close = ngPaneManagerInternal.childrenWithClass(ngPaneManagerInternal.childrenWithClass(top.children(), 'ng-pane-manager-header'), 'ng-pane-manager-close');
                                                    }
                                                    close.on('click', function() {
                                                        var node = ngPaneManager.getNodeAtPath(layoutGet(), nodePath);
                                                        removeSplitChild(node, 0);
                                                        $scope.$digest();
                                                    });
                                                }
                                                if(bottomNode.split === undefined) {
                                                    if(bottomNode.alwaysTab) {
                                                        close = ngPaneManagerInternal.childrenWithClass(ngPaneManagerInternal.childrenWithClass(ngPaneManagerInternal.childrenWithClass(bottom.children(), 'ng-pane-manager-tab-nav'), 'ng-pane-manager-tab'), 'ng-pane-manager-close');
                                                    } else {
                                                        close = ngPaneManagerInternal.childrenWithClass(ngPaneManagerInternal.childrenWithClass(bottom.children(), 'ng-pane-manager-header'), 'ng-pane-manager-close');
                                                    }
                                                    close.on('click', function() {
                                                        var node = ngPaneManager.getNodeAtPath(layoutGet(), nodePath);
                                                        removeSplitChild(node, 1);
                                                        $scope.$digest();
                                                    });
                                                }
                                                dragListeners[dragId++] = {
                                                    element: sep,
                                                    priority: 2,
                                                    dragHandler: function(info) {
                                                        var node = ngPaneManager.getNodeAtPath(layoutGet(), nodePath);
                                                        var elOffs = ngPaneManagerInternal.elementOffset(element);
                                                        node.ratio = Math.max(0, Math.min(1, (info.pageY - elOffs.top)/ngPaneManagerInternal.elementHeight(element)));
                                                    }
                                                };
                                            }
                                        }
                                        break;
                                    case 'tabs':
                                        {
                                            element = angular.element(tabsplitHTML);
                                            var tabNav = ngPaneManagerInternal.childrenWithClass(element, 'ng-pane-manager-tab-nav');
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
                                                var title = ngPaneManagerInternal.childrenWithClass(tab, 'ng-pane-manager-title');
                                                if(tabNode.closeable === undefined || tabNode.closeable) {
                                                    initCloseButton(ngPaneManagerInternal.childrenWithClass(tab, 'ng-pane-manager-close'));
                                                } else {
                                                    ngPaneManagerInternal.childrenWithClass(tab, 'ng-pane-manager-close').remove();
                                                }
                                                ngPaneManagerInternal.childrenWithClass(title, 'ng-pane-manager-title-text').text(ngPaneManagerInternal.computeLayoutTitle(tabNode));
                                                if(tabNode.split === undefined && tabNode.icon !== undefined) {
                                                    ngPaneManagerInternal.childrenWithClass(title, 'ng-pane-manager-icon').append(icons[tabNode.id]);
                                                } else {
                                                    ngPaneManagerInternal.childrenWithClass(title, 'ng-pane-manager-icon').remove();
                                                }
                                                if(interactive) {
                                                    var nodePath = ngPaneManager.computeNodePath(root, node);
                                                    ngPaneManagerInternal.childrenWithClass(tab, 'ng-pane-manager-close').on('click', function() {
                                                        var node = ngPaneManager.getNodeAtPath(layoutGet(), nodePath);
                                                        removeSplitChild(node, i);
                                                        $scope.$digest();
                                                    });
                                                    dragListeners[dragId++] = {
                                                        element: tab,
                                                        priority: 1,
                                                        threshold: headerDragThreshold,
                                                        dragHandler: function(info) {
                                                            var node = ngPaneManager.getNodeAtPath(layoutGet(), nodePath);
                                                            beginFloating(info, node.children[i]);
                                                        }
                                                    };
                                                }
                                                if(i === node.activeTabIndex) {
                                                    tab.addClass('ng-pane-manager-tab-active');
                                                }
                                                tabNav.append(tab);
                                            })(i);
                                            initTabNavAddElement(node, tabNav);
                                            var needsSideBorders = function() {
                                                for(var p = ngPaneManager.findParent(root, node); p !== null; p = ngPaneManager.findParent(root, p[0])) {
                                                    if(p[0].split === 'vertical') {
                                                        return false;
                                                    }
                                                }
                                                return true;
                                            };
                                            var needsBottomBorder = function() {
                                                for(var p = ngPaneManager.findParent(root, node); p !== null; p = ngPaneManager.findParent(root, p[0])) {
                                                    if(p[0].split === 'horizontal') {
                                                        return false;
                                                    }
                                                }
                                                return true;
                                            };
                                            if(needsSideBorders()) {
                                                var borderLeft = angular.element('<div class="ng-pane-manager-border ng-pane-manager-vertical-border"></div>');
                                                var borderRight = angular.element('<div class="ng-pane-manager-border ng-pane-manager-vertical-border"></div>');
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
                                                var borderBottom = angular.element('<div class="ng-pane-manager-border ng-pane-manager-horizontal-border"></div>');
                                                borderBottom.css('height', config.borderWidth + 'px');
                                                borderBottom.css('bottom', '0');
                                                element.append(borderBottom);
                                            }
                                            if(interactive) {
                                                var nodePath = ngPaneManager.computeNodePath(root, node);
                                                dragListeners[dragId++] = {
                                                    element: tabNav,
                                                    priority: 0,
                                                    threshold: headerDragThreshold,
                                                    dragHandler: function(e) {
                                                        var node = ngPaneManager.getNodeAtPath(layoutGet(), nodePath);
                                                        beginFloating(e, node);
                                                    }
                                                };
                                            }
                                            var activeChild = node.children[node.activeTabIndex];
                                            var contents = ngPaneManagerInternal.childrenWithClass(element, 'ng-pane-manager-contents');
                                            contents.css('top', config.headerHeight + 'px');
                                            if(activeChild.split !== undefined) {
                                                construct(root, node.children[node.activeTabIndex], contents, interactive);
                                            } else {
                                                contents.append(panels[activeChild.id]);
                                            }
                                        }
                                        break;
                                    default:
                                        ngPaneManagerInternal.validationFail();
                                }
                                element.data('ngPaneManagerNode', ngPaneManager.cloneLayout(node));
                                element.data('ngPaneManagerConfig', configCopy);
                                container.append(element);
                            } else {
                                var panel = panels[node.id];
                                var panelContainer, header, contents, title, close;
                                if(node.alwaysTab) {
                                    // if the node always wants to be in a tab, but is not currently in a tab split, create a fake tab split
                                    panelContainer = angular.element(panelContainerPseudoTabHTML);
                                    header = ngPaneManagerInternal.childrenWithClass(panelContainer, 'ng-pane-manager-tab-nav');
                                    contents = ngPaneManagerInternal.childrenWithClass(panelContainer, 'ng-pane-manager-contents');

                                    // note: the width of the tab will be calculated after the DOM is built in updateContainerTabWidths
                                    var tab = ngPaneManagerInternal.childrenWithClass(header, 'ng-pane-manager-tab');
                                    title = ngPaneManagerInternal.childrenWithClass(tab, 'ng-pane-manager-title');
                                    close = ngPaneManagerInternal.childrenWithClass(tab, 'ng-pane-manager-close');

                                    initTabNavAddElement(node, header);
                                } else {
                                    panelContainer = angular.element(panelContainerHTML);
                                    header = ngPaneManagerInternal.childrenWithClass(panelContainer, 'ng-pane-manager-header');
                                    contents = ngPaneManagerInternal.childrenWithClass(panelContainer, 'ng-pane-manager-contents');
                                    title = ngPaneManagerInternal.childrenWithClass(header, 'ng-pane-manager-title');
                                    close = ngPaneManagerInternal.childrenWithClass(header, 'ng-pane-manager-close');
                                }
                                if(node.closeable === undefined || node.closeable) {
                                    initCloseButton(close);
                                } else {
                                    close.remove();
                                }
                                header.css('height', config.headerHeight + 'px');
                                contents.css('top', config.headerHeight + 'px');
                                ngPaneManagerInternal.childrenWithClass(title, 'ng-pane-manager-title-text').text(ngPaneManagerInternal.computeLayoutTitle(node));
                                if(node.icon !== undefined) {
                                    ngPaneManagerInternal.childrenWithClass(title, 'ng-pane-manager-icon').append(icons[node.id]);
                                } else {
                                    ngPaneManagerInternal.childrenWithClass(title, 'ng-pane-manager-icon').remove();
                                }
                                contents.append(panel);
                                var needsSideBorders = function() {
                                    for(var p = ngPaneManager.findParent(root, node); p !== null; p = ngPaneManager.findParent(root, p[0])) {
                                        if(p[0].split === 'vertical') {
                                            return false;
                                        }
                                    }
                                    return true;
                                };
                                var needsBottomBorder = function() {
                                    for(var p = ngPaneManager.findParent(root, node); p !== null; p = ngPaneManager.findParent(root, p[0])) {
                                        if(p[0].split === 'horizontal') {
                                            return false;
                                        }
                                    }
                                    return true;
                                };
                                if(needsSideBorders()) {
                                    var borderLeft = angular.element('<div class="ng-pane-manager-border ng-pane-manager-vertical-border"></div>');
                                    var borderRight = angular.element('<div class="ng-pane-manager-border ng-pane-manager-vertical-border"></div>');
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
                                    var borderBottom = angular.element('<div class="ng-pane-manager-border ng-pane-manager-horizontal-border"></div>');
                                    borderBottom.css('height', config.borderWidth + 'px');
                                    borderBottom.css('bottom', '0');
                                    container.append(borderBottom);
                                }
                                if(interactive) {
                                    var nodePath = ngPaneManager.computeNodePath(root, node);
                                    dragListeners[dragId++] = {
                                        element: header,
                                        priority: 0,
                                        threshold: headerDragThreshold,
                                        dragHandler: function(e) {
                                            var node = ngPaneManager.getNodeAtPath(layoutGet(), nodePath);
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
                                var close;
                                if(layout.alwaysTab) {
                                    close = ngPaneManagerInternal.childrenWithClass(ngPaneManagerInternal.childrenWithClass(ngPaneManagerInternal.childrenWithClass(allContainer.children(), 'ng-pane-manager-tab-nav'), 'ng-pane-manager-tab'), 'ng-pane-manager-close');
                                } else {
                                    close = ngPaneManagerInternal.childrenWithClass(ngPaneManagerInternal.childrenWithClass(allContainer.children(), 'ng-pane-manager-header'), 'ng-pane-manager-close');
                                }
                                // special case with one root panel
                                close.on('click', function() {
                                    layoutSet(null);
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
                                var elOffs = ngPaneManagerInternal.elementOffset($element);
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
                                                    angular.element(ngPaneManagerInternal.childrenWithClass(tabNav, 'ng-pane-manager-tab')[target.tabIndex-1]).after(tabVisual);
                                                }
                                                var futureLayout = ngPaneManager.cloneLayout(target.node);
                                                futureLayout.children.splice(target.tabIndex, 0, floatingState.layout);
                                                var tabs = 
                                                    angular.element(Array.prototype.slice.call(ngPaneManagerInternal.childrenWithClass(tabNav, 'ng-pane-manager-tab'))
                                                        .concat(ngPaneManagerInternal.childrenWithClass(tabNav, 'ng-pane-manager-drop-visual-tab')));
                                                for(var index = 0; index !== tabs.length; ++index) {
                                                    angular.element(tabs[index]).css('width', computeTabWidth(futureLayout, ngPaneManagerInternal.elementWidth(tabNav), index) + 'px');
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
                                                    left: computeTabWidth(futureLayout, ngPaneManagerInternal.elementWidth(header), 0) + 'px',
                                                    width: computeTabWidth(futureLayout, ngPaneManagerInternal.elementWidth(header), 1) + 'px',
                                                    height: config.headerHeight + 'px'
                                                });
                                            }
                                            break;
                                        default:
                                            ngPaneManagerInternal.validationFail();
                                    }
                                    if(visual !== null) {
                                        element.prepend(visual);
                                    }
                                }
                            }
                        }
                        // notify all panels of a resize
                        Object.keys(panels).forEach(function(id) {
                            var panel = panels[id];
                            var listeners = panel.data('ngPaneManagerResizeListeners');
                            for(var i = 0; i !== listeners.length; ++i) {
                                listeners[i]();
                            }
                        });
                    }
                }).catch(function(e) {
                    templateResolver = null;
                    if(!(e instanceof TemplateResolver.AbortedException)) {
                        $exceptionHandler(e);
                    }
                });
            };

            // config/layout watcher
            var flipflop = true;
            var lastLayout = undefined;
            var lastFloatingState = undefined;
            var lastConfig = undefined;
            $scope.$watch(function() {
                var layout = ngPaneManager.cloneLayout(layoutGet());
                var flState = cloneFloatingState(floatingState);
                var config = ngPaneManager.cloneConfig(configGet());
                ngPaneManager.derefLayout(layout, config);
                if(flState !== null) {
                    ngPaneManager.derefLayout(flState.layout, config);
                }
                ngPaneManager.derefConfig(config);
                var changed = 
                       lastLayout !== undefined && !ngPaneManager.layoutsEqual(lastLayout, layout)
                    || lastFloatingState !== undefined && !floatingStatesEqual(lastFloatingState, flState)
                    || lastConfig !== undefined && !ngPaneManager.configsEqual(config, lastConfig);
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
.service('ngPaneManagerInternal', [function() {
    /**
     * Pattern matching (used for insertLeaf)
     * 
     * The way this works is first we try to match against 'patterns'. 
     * Each pattern in 'patterns' is a tree, where each node is either 
     * a split or a mapping from possible gravities to simpler gravity 
     * (this will be defined shortly). If a match is found, each mapping 
     * is used to convert the layouts' gravities into a simpler hierarchy.
     * For example, if insertLeaf is given a layout that looks like this:
     *
     * |---|---|---|
     * | 1 | 2 | 3 |
     * |---|---|---|
     *   L   L   R
     *
     * and has the following tree:
     *
     *   vsplit
     *    /   \
     *  1(L)    vsplit
     *          /   \
     *        2(L)  3(R)
     *
     * (L/R means left/right gravity, the number is the panel id).
     * 
     * This layout will match the pattern 
     *
     * {
     *     split: 'vertical',
     *     children: [
     *         [['left', 'right'], 'left'],
     *         {
     *             split: 'vertical',
     *             children: [
     *                 [[null, 'left', 'right', 'center'], 'center'],
     *                 [['left', 'right'], 'right']
     *             ]
     *         }
     *     ]
     * }
     *
     * and provide a simpler gravity hierarchy for this tree like this:
     *
     * |---|---|---|
     * | 1 | 2 | 3 |
     * |---|---|---|
     *   L   C   R
     *
     * (C means center gravity).
     *
     * Next we consider the gravity of the panel being inserted. Say we want to insert a
     * panel 4 with center gravity.
     *
     * We look at the simplified hierarchy. If we find a node with the same gravity as that
     * of the panel being inserted, we will create a tab split with that node. In this case, 
     * panel 4 will create a tab split with panel 2.
     *
     * It's possible that the simpler hierarchy won't have the gravity we're looking for. 
     * For example, say we did the following transformation:
     *
     * |---|---|        |---|---|
     * | 1 | 2 |   ->   | 1 | 2 |
     * |---|---|        |---|---|
     *   L   L            L   R
     *
     * If we want to insert a panel 3 with center gravity, we need something to figure out 
     * how to perform this insertion, since there is no node we can do a tab split with.
     *
     * Now we look at the insert strategies for the gravity of the panel being inserted. For center,
     * this is the array insertCenterStrategies.
     *
     * We find the strategy that matches the simplified hierarchy, in this case that would be:
     * 
     * {
     *     from: {
     *         split: 'vertical',
     *         children: [
     *             'left',
     *             'right'
     *         ]
     *     },
     *     split: 'vertical',
     *     index: 1,
     *     node: function(node) {
     *         return node.children[0];
     *     }
     * }
     *
     * This strategy says to insert the panel by performing a vertical split with the left node and 
     * having the center panel be the second item in the vertical split.
     *
     * In summary, pattern matching works like this:
     * 1. Match 'patterns', simplify the gravity hierarchy using the match.
     * 2. If the simplified hierarchy contains a panel with the same gravity as that of the
     *    panel being inserted, create a tab split with that node, otherwise...
     * 3. Find the appropriate insert strategy to insert the panel into the hierarchy.
     */

    // keep in order: most precise to least precise
    this.patterns = [
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
                                [[null, 'left', 'right', 'center', 'bottom'], 'center'],
                                [['left', 'right'], 'right']
                            ]
                        }
                    ]
                },
                [[null, 'left', 'right', 'center', 'bottom'], 'bottom']
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
                                [[null, 'left', 'right', 'center', 'bottom'], 'center']
                            ]
                        },
                        [['left', 'right'], 'right']
                    ]
                },
                [[null, 'left', 'right', 'center', 'bottom'], 'bottom']
            ]
        },
        {
            split: 'vertical',
            children: [
                [['left', 'right'], 'left'],
                {
                    split: 'vertical',
                    children: [
                        [[null, 'left', 'right', 'center', 'bottom'], 'center'],
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
                        [[null, 'left', 'right', 'center', 'bottom'], 'center']
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
                        [[null, 'center'], 'center']
                    ]
                },
                [[null, 'left', 'right', 'center', 'bottom'], 'bottom']
            ]
        },
        {
            split: 'horizontal',
            children: [
                {
                    split: 'vertical',
                    children: [
                        [[null, 'center'], 'center'],
                        [['left', 'right'], 'right']
                    ]
                },
                [[null, 'left', 'right', 'center', 'bottom'], 'bottom']
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
                [[null, 'left', 'right', 'center', 'bottom'], 'bottom']
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
                [['left', 'right'], 'left'],
                [['left', 'right'], 'right']
            ]
        },
        {
            split: 'horizontal',
            children: [
                [[null, 'center'], 'center'],
                [[null, 'left', 'right', 'center', 'bottom'], 'bottom']
            ]
        },
        {
            split: 'horizontal',
            children: [
                [['left'], 'left'],
                [[null, 'left', 'right', 'center', 'bottom'], 'bottom']
            ]
        },
        {
            split: 'horizontal',
            children: [
                [['right'], 'right']
                [[null, 'left', 'right', 'center', 'bottom'], 'bottom']
            ]
        },
        [[null, 'center'], 'center'],
        [['left'], 'left'],
        [['right'], 'right'],
        [['bottom'], 'bottom']
    ];

    var addBottomStrategies = function(strategies) {
        var result = [];
        strategies.forEach(function(strat) {
            result.push({
                from: {
                    split: 'horizontal',
                    children: [
                        strat.from,
                        'bottom'
                    ]
                },
                split: strat.split,
                index: strat.index,
                node: function(node) {
                    return strat.node(node.children[0]);
                }
            });
            result.push(strat);
        });
        result.push({
            from: 'bottom',
            split: 'horizontal',
            index: 0,
            node: function(node) {
                return node;
            }
        });
        return result;
    };

    var insertCenterStrategies = [
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
        }
    ];
    insertCenterStrategies = addBottomStrategies(insertCenterStrategies);

    var insertLeftStrategies = [
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
        }
    ];
    insertLeftStrategies = addBottomStrategies(insertLeftStrategies);

    var insertRightStrategies = [
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
        }
    ];
    insertRightStrategies = addBottomStrategies(insertRightStrategies);

    var insertBottomStrategies = [
        {
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
        {
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
        {
            split: 'vertical',
            children: [
                'left',
                'center'
            ]
        },
        {
            split: 'vertical',
            children: [
                'center',
                'right'
            ]
        },
        {
            split: 'vertical',
            children: [
                'left',
                'right'
            ]
        },
        'left',
        'right',
        'center'
    ].map(function(from) {
        return {
            from: from,
            split: 'horizontal',
            index: 1,
            node: function(node) {
                return node;
            }
        };
    });

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
            if(bestMatch === null || score > bestMatchPrecision) {
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

    this.REF_PREFIX = '$$ngPaneManagerRef:';

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
        if(layout === null) {
            return [];
        }
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
            if(root.alwaysTab !== undefined && typeof root.alwaysTab !== 'boolean') {
                throw new Error('alwaysTab must be a boolean');
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
        if(root.gravity !== undefined) {
            if(typeof root.gravity !== 'string') {
                throw new Error('gravity must be a string');
            }
            switch(root.gravity) {
                case 'left':
                case 'center':
                case 'right':
                case 'bottom':
                    break;
                default:
                    throw new Error('gravity must be either left, center, right, or bottom');
            }
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
                if(root.icon !== undefined) {
                    this.derefTemplate(root.icon, config);
                }
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
                        ngPaneManagerInternal.validationFail();
                }
                result.children = root.children.map(this.cloneLayout.bind(this));
            } else {
                result.id = root.id;
                result.title = root.title;
                if(root.closeable !== undefined) {
                    result.closeable = root.closeable;
                }
                if(root.alwaysTab !== undefined) {
                    result.alwaysTab = root.alwaysTab;
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
            if(!config.getterSetter) {
                this.derefLayout(config.layout);
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
            marginWidth: config.marginWidth,
            getterSetter: config.getterSetter,
            closeButton: this.cloneTemplate(config.closeButton),
            tabNavAddButtonEnabled: config.tabNavAddButtonEnabled,
            tabNavAddButtonHandler: config.tabNavAddButtonHandler,
            tabNavAddButton: this.cloneTemplate(config.tabNavAddButton),
            refs: this.cloneRefs(config.refs),
            layout: config.getterSetter ? config.layout : this.cloneLayout(config.layout)
        };
    };

    this.configsEqual = function(a, b) {
        if(a.headerHeight !== b.headerHeight) {
            return false;
        }
        if(a.borderWidth !== b.borderWidth) {
            return false;
        }
        if(a.marginWidth !== b.marginWidth) {
            return false;
        }
        if(a.getterSetter !== b.getterSetter) {
            return false;
        }
        if(!this.templatesEqual(a.closeButton, b.closeButton)) {
            return false;
        }
        if(a.tabNavAddButtonEnabled !== b.tabNavAddButtonEnabled) {
            return false;
        }
        if(a.tabNavAddButtonHandler !== b.tabNavAddButtonHandler) {
            return false;
        }
        if(!this.templatesEqual(a.tabNavAddButton, b.tabNavAddButton)) {
            return false;
        }
        if(!this.refsEqual(a.refs, b.refs)) {
            return false;
        }
        if(a.getterSetter) {
            if(a.layout !== b.layout) {
                return false;
            }
        } else {
            if(!this.layoutsEqual(a.layout, b.layout)) {
                return false;
            }
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
                } else if(node.id == id) {
                    return node;
                } else {
                    return null;
                }
            };
            return f(root);
        }
    };

    this.findInsertStrategy = function(match, nodeToInsert) {
        var gravity = this.computeLayoutGravity(nodeToInsert);
        if(!(gravity in this.insertStrategies)) {
            throw new Error('\'' + gravity + '\' is not a valid type of panel gravity');
        }
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
                throw new Error('when using insertLeaf, all leaves in the layout must have gravity defined');
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
                ['closeThisPanel', 'onPanelResize', 'offPanelResize'].forEach(function(k) {
                    if(template.scope[k]) {
                        throw new Error('\'' + k + '\' cannot be added to the panel\'s scope, it is reserved for ngPaneManager');
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
