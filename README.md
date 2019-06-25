# ngPaneManager

ngPaneManager is a docking panel system for AngularJS. It...
* Supports vertical splits, horizontal splits, and tab splits (configurable by both developer and user)
* Has a straight-forward API that takes advantage of AngularJS data binding
* Supports serializing/deserializing panel layouts
* Is easily themeable

[Online Demo](https://opuslogica.github.io/ng-pane-manager/test/demo.htm)

<img src="demo.gif">

# Table Of Contents

- [Installation](#installation)
- [Developer Guide](#dev-guide)
    - [Hello World](#hello-world)
    - [Vertical/Horizontal Splits](#vh-splits)
    - [Tab Splits](#tab-splits)
    - [Serialize/Deserialize](#ser-deser)
    - [Themes](#themes)
    - [Inserting Panels](#inserting-panels)
    - [Other Features](#other-features)
- [Reference](#reference)
    - [Configuration](#configuration)
    - [Layout](#layout)
    - [Templates](#templates)
    - [Panel Scope](#panel-scope)
    - [ngPaneManager Service](#functions)

# Installation
<a name="installation"></a>

`npm install ng-pane-manager`

# Developer Guide
<a name="dev-guide"></a>

## Hello World
<a name="hello-world"></a>

There is one directive: `ng-pane-manager`.

``` HTML 
<body ng-app="myApp">
    <div ng-controller="myController" ng-pane-manager="config"></div>
</body>
```

The following controller would produce a single panel with some text:

``` JavaScript
app.controller('myController', function($scope) {
    $scope.config = {
        layout: {
            id: 'test-panel',
            title: 'Test Panel'
            panel: {
                template: '<span>Some text!</span>'
            }
        }
    };
});
```

## Vertical/Horizontal Splits
<a name="vh-splits"></a>

You can display panels adjacently with a `vertical` or `horizontal` split:

``` JavaScript
app.controller('myController', function($scope) {
    $scope.config = {
        layout: {
            split: 'vertical',
            ratio: 0.5,
            children: [
                {
                    id: 'test-panel-1',
                    title: 'Test Panel 1'
                    icon: {
                        template: '<div class="icon"></div>' // Optional: icon you want appear in the header
                    },
                    panel: {
                        template: '<span>Some text!</span>'
                    }
                },
                {
                    id: 'test-panel-2',
                    title: 'Test Panel 2'
                    panel: {
                        template: '<span>Some more text!</span>'
                    }
                }
            ]
        }
    };
});
```

## Tab Splits
<a name="tab-splits"></a>

You can have 2+ panels appear as tabs:

``` JavaScript
app.controller('myController', function($scope) {
    $scope.config = {
        layout: {
            split: 'tabs',
            activeTabIndex: 0,
            children: [
                {
                    id: 'test-panel-1',
                    title: 'Test Panel 1',
                    panel: {
                        template: '<span>Some {{str}}!</span>',
                        scope: {
                            str: 'stuff'
                        }
                    },
                },
                {
                    id: 'test-panel-2',
                    title: 'Test Panel 2',
                    icon: {
                        templateUrl: 'panel3Icon.html'
                    },
                    panel: {
                        template: '<span>Even more {{something}}!</span>',
                        controller: function($scope, injectedThing) {
                            $scope.something = injectedThing;
                        },
                        resolve: {
                            injectedThing: function() {
                                return 'stuff';
                            }
                        }
                    }
                },
                {
                    id: 'test-panel-3',
                    title: 'Test Panel 3',
                    panel: {
                        template: '<div>I will be in the third tab!</div>'
                    }
                }
            ]
        }
    };
});
```

## Serialize/Deserialize
<a name="ser-deser"></a>

You may want your application to save the panel state (e.g. to cookies or local storage). The way to do this is to `JSON.stringify()` the `layout` property. There is one caveat: some options (e.g. `controller` or `resolve`) can accept functions, which cannot be serialized. If you need to use these options, you can use _refs_ to separate out the unserializable state.

For example, if your config looks like this...

``` JavaScript
app.controller('myController', function($scope) {
    $scope.config = {
        layout: {
            id: 'test-panel',
            title: 'Test Panel',
            panel: {
                template: '<div>Some {{thing}}!</div>',
                controller: function($scope, injectedThing) {
                    $scope.thing = injectedThing;
                },
                resolve: {
                    injectedThing: function() {
                        return 'stuff';
                    }
                }
            }
        }
    };
});
```
...you can write a save/load function like this:

``` JavaScript
app.controller('myController', function(ngPaneManager, $scope, $cookies) {
    $scope.config = {
        refs: {
            panelController: function($scope, injectedThing) {
                $scope.thing = injectedThing;
            },
            injectedThing: function() {
                return 'stuff';
            }
        },
        layout: {
            id: 'test-panel',
            title: 'Test Panel',
            panel: {
                template: '<div>Some {{thing}}!</div>',
                controller: ngPaneManager.ref('panelController'),
                resolve: {
                    injectedThing: ngPaneManager.ref('injectedThing')
                }
            }
        }
    };

    $scope.save = function() {
        // save the layout to cookies
        var str = JSON.stringify($scope.config.layout);
        $cookies.put('layout', str);
    };

    $scope.load = function() {
        // load the layout from cookies
        $scope.config.layout = JSON.parse($cookies.get('layout'));
    };
});
```

All `ngPaneManager.ref()` calls (see the [ngPaneManager service reference](#functions)) will return a magic string that can be serialized. When the config is evaluated by ngPaneManager, these strings will be expanded to the ref specified in the `refs` config property.

## Themes
<a name="themes"></a>

See [themes/black.css](themes/black.css) for an example of how to make an ngPaneManager theme. Some theming properties (e.g. `headerHeight`, `borderWidth`, `marginWidth`) are also available in the configuration object.

## Inserting Panels
<a name="inserting-panels"></a>

If you have a complex layout and want to insert another panel into it, `ngPaneManager.insertLeaf()` (see the [ngPaneManager service reference](#functions)) can automatically insert a panel into the layout given a gravity and (optional) grouping.

## Other Features
<a name="other-features"></a>

There are other auxiliary features documented in the [reference section](#reference). Be sure to check out the [ngPaneManager service reference](#functions), which contains more examples and useful utility functions. 

# Reference
<a name="reference"></a>

## Configuration
<a name="configuration"></a>

The `ng-pane-manager` directive accepts the following options:
- `headerHeight` (Number): The height of the header of each window. (default 20px)
- `borderWidth` (Number): The width of the borders of each window. (default: 2px)
- `marginWidth` (Number): The width of the margins surrounding the layout. When the user is dragging a window, they can drag it into the margins to split an entire side of the layout instead of a particular window. (default: 20px)
- `getterSetter` (Boolean): Whether the `layout` property is a getter/setter function. (default: false)
- `closeButton`: The [template](#templates) describing how the windows' close buttons should be rendered. (default is an HTML template with a Unicode cross).
- `refs`: An object describing the values to which ngPaneManager refs will be expanded (see [Serialize/Deserialize](#ser-deser) and `ngPaneManager.ref` in the [functions reference](#functions) for an explanation).
- `layout`: The [object](#layout) describing the panel layout. If `getterSetter` is true, then this is a getter-setter function: if an argument is given, it should set the layout, otherwise it should return the layout.

## Layout
<a name="layout"></a>

The `layout` property is a tree of nodes. Each node is either a _leaf_ or a _split_.

Leaves have no children and must have an `id` property. They have the following properties:
- `id` (String): The ID of this leaf node. (required)
- `title` (String): The title that should be displayed in this panel's window. (required)
- `closeable` (Boolean): Whether the user should be able to close this panel's window.
- `alwaysTab` (Boolean): Whether this panel should always be contained in a tab instead of having its own header (optional)
- `icon` (Object): A [template](#templates) describing how the window's icon should be rendered. (optional)
- `panel` (Object): A [template](#templates) describing how this panel should be rendered. (required)

Splits have one or more children and must have a `split` property. They have the following properties:
- `split` (String): Either "vertical", "horizontal", or "tabs"
- `ratio` (Number): Number from 0 to 1 indicating the size ratio of the first panel to the second panel (required if vertical or horizontal split)
- `activeTabIndex` (Number): Index of the tab that is currently active (required if tab split)
- `children` (Array): Array of children. If the split is vertical or horizontal, there must be exactly 2 children. If the split is a tab split, there must be at least 2 children. (required)

All nodes also have the following properties:
- `gravity` (String): The gravity of this panel (see `ngPaneManager.insertLeaf` in the [function reference](#functions)). (optional, only required if using insertLeaf)
- `group` (String): The insert group of this panel (see `ngPaneManager.insertLeaf` in the [function reference](#functions)). (optional)
- `data` (Object): Arbitrary data to store along with this node. The object should be a plain key-value object, with the ID of the data as the key and your data as the value. (optional) 

## Templates
<a name="templates"></a>

Options that take templates (e.g. `closeButton`, `icon`, `panel`) take an object with the following properties:
- `template` (String): The angular template as a string. (required unless `templateUrl` is defined)
- `templateUrl` (String): The URL to the template. (required unless `template` is defined)
- `controller` (String | Function | Array): If this is a string, then it is the name of the controller to use for the template. If this is a function or array, then it is the controller definition. (optional)
- `resolve` (Object): An object where the key is the name to inject into the controller, and the value is a function that either returns a value or a `$q` promise that resolves to a value ([example](test/2.htm)). (optional)
- `scope` (Object): An object where each key is added to the template's scope with the given value ([example](test/3.htm)). (optional)

## Panel Scope
<a name="panel-scope"></a>

The controller of a panel has the following functions available in `$scope`:
- `closeThisPanel()`: Removes the panel from the layout
- `onPanelResize(listener)`: Adds a listener that gets fired whenever the panel resizes (or is initially constructed). This is useful when embedding content into panels that needs to be manually notified of its container resizing.
- `offPanelResize(listener)`: Removes a panel resize listener.

## ngPaneManager Service
<a name="functions"></a>

The `ngPaneManager` service contains many auxiliary functions that are helpful for working with your ngPaneManager layouts and configuration.

[Online Reference](https://opuslogica.github.io/ng-pane-manager/docs/index.html)

You can build this reference yourself by installing [documentation.js](https://www.npmjs.com/package/documentation) and running `make`.
