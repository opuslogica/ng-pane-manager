# ngDocker

TODO add a GIF of moving panels around

ngDocker is a docking panel system for AngularJS. It...
* Supports vertical splits, horizontal splits, and tab splits (configurable by both developer and user)
* Has an easy-to-use API that takes advantage of AngularJS data binding
* Supports serializing/deserializing panel layouts
* Is easily themeable

[Demo 1](https://sashavol.com/misc/ngDocker/test/2.htm) 
[Demo 2](https://sashavol.com/misc/ngDocker/test/3.htm)

# Installation

TODO

# Developer Guide

## Hello World

There is one directive: `ng-docker`.

``` HTML 
<body ng-app="myApp">
    <div ng-controller="myController" ng-docker="config"></div>
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
app.controller('myController', function(ngDocker, $scope, $cookies) {
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
                controller: ngDocker.ref('panelController'),
                resolve: {
                    injectedThing: ngDocker.ref('injectedThing')
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

All `ngDocker.ref()` calls will return a magic string that can be serialized. When the config is evaluated by ngDocker, these strings will be expanded to the ref specified in the `refs` config property.

## Themes

To use a theme, include the theme's stylesheet _after_ `ngDocker.css`.

See [themes/black.css](themes/black.css) for an example of how to make an ngDocker theme. Some theming properties (e.g. `headerHeight`, `borderWidth`, `marginWidth`) are also available in the configuration object.

# Reference

## Configuration

## Layout

## Utility Functions
