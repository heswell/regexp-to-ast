[![CircleCI](https://circleci.com/gh/bd82/regexp-to-ast.svg?style=svg)](https://circleci.com/gh/bd82/regexp-to-ast)

# regexp-to-ast

Reads a JavaScript Regular Expression **literal**(text) and outputs an Abstract Syntax Tree.

## Installation 

* npm
  ```
    npm install regexp-to-ast
  ```
* Browser
  ```
    <script src="https://unpkg.com/regexp-to-ast/lib/parser.js"></script>
  ```

## API

The [API](https://github.com/bd82/regexp-to-ast/blob/master/api.d.ts) is defined as a TypeScript definition file.

## Usage
```javascript
const regexpToAst = require("regexp-to-ast")
const regexpParser = new regexpToAst.parser()

// from a regexp text
const output = regexpParser.pattern("/a|b|c/g")

// text from regexp instance.
const input2 = /a|b/.toString()
// The same parser instance can be reused
const anotherOutput = regexpParser.pattern(input2)
```

## Compatability 

This library is written in ES**5** style and is compatiable with all major browsers and **modern** node.js versions.

## TODO / Limitations

* Descriptive error messages.
* Position information in error messages.
* Support unicode flag escapes.
* Ensure edge cases described in ["The madness of parsing real world JavaScript regexps"](https://hackernoon.com/the-madness-of-parsing-real-world-javascript-regexps-d9ee336df983) are supported.
