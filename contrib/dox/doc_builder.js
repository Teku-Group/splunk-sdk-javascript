// Copyright 2011 Splunk, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

// Originally modified from Davis.js:
// https://github.com/olivernn/davis.js
// MIT/X11 Licensed

(function() {
  var path = require('path');
  var fs = require('fs');
  var mustache = require('mu');
  var counter = 0;
  var URL_ROOT = "https://github.com/splunk/splunk-sdk-javascript/blob/master/";

  var formatCode = function(doc) {
        var code = doc.code || "";
        var split = code.split("\n");
        if (split.length > 1) {
            var leftAlign = 0;
            while(true) {
                var fail = false;
                
                for(var i = 1; i < split.length; i++) {
                    var line = split[i];
                    if (line.trim() !== "" && line[leftAlign] !== " ") {
                        fail = true;
                        break;
                    }
                }
                
                if (fail) {
                    break;
                }
                else {
                    leftAlign++;
                }
            }
            
            for(var i = 1; i < split.length; i++) {
                split[i] = split[i].slice(leftAlign);
            }
            
            code = split.join("\n");
        }
        
        return code;
  };

  var getCommentContext = function(doc) {
    // Ignore ignored and private blocks
    if (doc.ignore || doc.isPrivate) {
        return;
    }

    // Find the parent module and note the name
    var parent = function () {
        var module = "Global";
        for(var i = 0; i < doc.tags.length; i++) {
            var tag = doc.tags[i];
            if (tag.type === "module") {
                module = tag.content;
            }
            else if (tag.type === "globals") {
                module = tag.content;
            }
        }
        
        return module.trim();
    }

    // Find any related tags, and create the structure for it
    var relatedTag = doc.tags.filter(function (tag) { return tag.type === "see"; })[0]
    if (relatedTag) {
        var related = {
            name: relatedTag.local,
            href: relatedTag.local ? relatedTag.local : ''
        }
    };
    
    var code = formatCode(doc);
    
    // Is this a constructor?
    var isConstructor = doc.tags.some(function(tag) {
        return (tag.type === "constructor");
    });

    // Is this a module definition, and if so, what is the
    // name of this module?
    var moduleName = "";
    var isModule = doc.tags.some(function (tag) { 
        if (tag.type === "moduleRoot") {
            moduleName = tag.content;
            return true;
        }
        
        return false;
    });
    
    // Is this a global, and if so, what is the name of the
    // containing module?
    var globalName = "";
    var isGlobal = doc.tags.some(function (tag) { 
        if (tag.type === "globals") {
            globalName = tag.content;
            return true;
        }
        
        return false;
    });
    
    var extendsName = "";
    var isExtends = doc.tags.some(function(tag) {
        if (tag.type === "extends") {
            extendsName = tag.content;
            return true;
        }
        
        return false;
    });
    
    var name = moduleName || doc.ctx && doc.ctx.name;
    var signature = (isGlobal || !isModule) ? parent() + "." + name : doc.ctx && doc.ctx.string;

    return {
        id: [counter++, Date.now()].join('-'),
        name: name,
        signature: signature,
        line: doc.line,
        filename: doc.filename,
        url: URL_ROOT + doc.filename,
        type: isConstructor ? "constructor" : (doc.ctx && doc.ctx.type),
        ctx: doc.ctx,
        description: doc.description,
        full_description: doc.description.full.replace(/<br( \/)?>/g, ' '),
        code: code,
        params: doc.tags.filter(function (tag) { return tag.type === 'param' }),
        has_params: !!doc.tags.filter(function (tag) { return tag.type === 'param' }).length,
        returns: doc.tags.filter(function (tag) { return tag.type === 'return' })[0],
        has_returns: !!doc.tags.filter(function (tag) { return tag.type === 'return' }).length,
        tags: doc.tags,
        module: isModule,
        parent: parent(),
        related: related,
        has_related: !!related,
        is_global: isGlobal,
        global: globalName,
        is_extends: isExtends,
        "extends": extendsName
    };
  }

  var filterUndefined = function(elem) {
    return !!elem
  }

  exports.generate = function(docs, version, callback) {
    var transformedDocs = docs.map(getCommentContext).filter(filterUndefined)

    var modules = transformedDocs.filter(function (doc) {
      return doc.module
    });

    modules.forEach(function (module) {
      module.methods = transformedDocs.filter(function (doc) {
        return doc.parent === module.name && !doc.is_global
      });
      
      module.helpers = transformedDocs.filter(function(doc) {
        return doc.is_global && doc.global === module.name;
      });
      
      module.has_globals = (module.helpers || []).length > 0;
    });
    

    mustache.compile(path.resolve(__dirname, 'template.mustache'), function (err, parsed) {
      if (err) {
          callback(err);
      }
      
      var buffer = "";
      mustache.render(parsed, { 
          modules: modules, 
          raw: JSON.
          stringify(modules), 
          version: version 
      }).on('data', function (data) {
        buffer += data;
      }).on('end', function() {
        callback(null, buffer);  
      });
    });
  };
})();