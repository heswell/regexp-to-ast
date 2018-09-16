(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (factory((global['regexp-to-ast'] = {})));
}(this, (function (exports) { 'use strict';

    // consts and utilities
    var hexDigitPattern = /[0-9a-fA-F]/;
    var decimalPattern = /[0-9]/;
    var decimalPatternNoZero = /[1-9]/;

    function cc(char) {
      return char.charCodeAt(0);
    }

    function insertToSet(item, set) {
      if (item.length !== undefined) {
        item.forEach(function (subItem) {
          set.push(subItem);
        });
      } else {
        set.push(item);
      }
    }

    function addFlag(flagObj, flagKey) {
      if (flagObj[flagKey] === true) {
        throw "duplicate flag " + flagKey;
      }

      flagObj[flagKey] = true;
    }

    function ASSERT_EXISTS(obj) {
      // istanbul ignore next
      if (obj === undefined) {
        throw Error("Internal Error - Should never get here!");
      }
    } // istanbul ignore next


    function ASSERT_NEVER_REACH_HERE() {
      throw Error("Internal Error - Should never get here!");
    }

    var i;
    var digitsCharCodes = [];

    for (i = cc("0"); i <= cc("9"); i++) {
      digitsCharCodes.push(i);
    }

    var wordCharCodes = [cc("_")].concat(digitsCharCodes);

    for (i = cc("a"); i <= cc("z"); i++) {
      wordCharCodes.push(i);
    }

    for (i = cc("A"); i <= cc("Z"); i++) {
      wordCharCodes.push(i);
    } // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp#character-classes


    var whitespaceCodes = [cc(" "), cc("\f"), cc("\n"), cc("\r"), cc("\t"), cc("\v"), cc("\t"), cc("\u00a0"), cc("\u1680"), cc("\u2000"), cc("\u2001"), cc("\u2002"), cc("\u2003"), cc("\u2004"), cc("\u2005"), cc("\u2006"), cc("\u2007"), cc("\u2008"), cc("\u2009"), cc("\u200a"), cc("\u2028"), cc("\u2029"), cc("\u202f"), cc("\u205f"), cc("\u3000"), cc("\ufeff")];
    class RegExpParser {
      saveState() {
        return {
          idx: this.idx,
          input: this.input,
          groupIdx: this.groupIdx
        };
      }

      restoreState(newState) {
        this.idx = newState.idx;
        this.input = newState.input;
        this.groupIdx = newState.groupIdx;
      }

      pattern(input) {
        // parser state
        this.idx = 0;
        this.input = input;
        this.groupIdx = 0;
        this.consumeChar("/");
        var value = this.disjunction();
        this.consumeChar("/");
        var flags = {
          type: "Flags",
          global: false,
          ignoreCase: false,
          multiLine: false,
          unicode: false,
          sticky: false
        };

        while (this.isRegExpFlag()) {
          switch (this.popChar()) {
            case "g":
              addFlag(flags, "global");
              break;

            case "i":
              addFlag(flags, "ignoreCase");
              break;

            case "m":
              addFlag(flags, "multiLine");
              break;

            case "u":
              addFlag(flags, "unicode");
              break;

            case "y":
              addFlag(flags, "sticky");
              break;
          }
        }

        if (this.idx !== this.input.length) {
          throw Error("Redundant input: " + this.input.substring(this.idx));
        }

        return {
          type: "Pattern",
          flags: flags,
          value: value
        };
      }

      disjunction() {
        var alts = [];
        alts.push(this.alternative());

        while (this.peekChar() === "|") {
          this.consumeChar("|");
          alts.push(this.alternative());
        }

        return {
          type: "Disjunction",
          value: alts
        };
      }

      alternative() {
        var terms = [];

        while (this.isTerm()) {
          terms.push(this.term());
        }

        return {
          type: "Alternative",
          value: terms
        };
      }

      term() {
        if (this.isAssertion()) {
          return this.assertion();
        } else {
          return this.atom();
        }
      }

      assertion() {
        switch (this.popChar()) {
          case "^":
            return {
              type: "StartAnchor"
            };

          case "$":
            return {
              type: "EndAnchor" // '\b' or '\B'

            };

          case "\\":
            switch (this.popChar()) {
              case "b":
                return {
                  type: "WordBoundary"
                };

              case "B":
                return {
                  type: "NonWordBoundary"
                };
            } // istanbul ignore next


            throw Error("Invalid Assertion Escape");
          // '(?=' or '(?!'

          case "(":
            this.consumeChar("?");
            var type;

            switch (this.popChar()) {
              case "=":
                type = "Lookahead";
                break;

              case "!":
                type = "NegativeLookahead";
                break;
            }

            ASSERT_EXISTS(type);
            var disjunction = this.disjunction();
            this.consumeChar(")");
            return {
              type: type,
              value: disjunction
            };
        } // istanbul ignore next


        ASSERT_NEVER_REACH_HERE();
      }

      quantifier() {
        var range;

        switch (this.popChar()) {
          case "*":
            range = {
              atLeast: 0,
              atMost: Infinity
            };
            break;

          case "+":
            range = {
              atLeast: 1,
              atMost: Infinity
            };
            break;

          case "?":
            range = {
              atLeast: 0,
              atMost: 1
            };
            break;

          case "{":
            var atLeast = this.integerIncludingZero();

            switch (this.popChar()) {
              case "}":
                range = {
                  atLeast: atLeast,
                  atMost: atLeast
                };
                break;

              case ",":
                var atMost;

                if (this.isDigit()) {
                  atMost = this.integerIncludingZero();
                  range = {
                    atLeast: atLeast,
                    atMost: atMost
                  };
                } else {
                  range = {
                    atLeast: atLeast,
                    atMost: Infinity
                  };
                }

                this.consumeChar("}");
                break;
            }

            ASSERT_EXISTS(range);
            break;
        }

        ASSERT_EXISTS(range);

        if (this.peekChar(0) === "?") {
          this.consumeChar("?");
          range.greedy = false;
        } else {
          range.greedy = true;
        }

        range.type = "Quantifier";
        return range;
      }

      atom() {
        var atom;

        switch (this.peekChar()) {
          case ".":
            atom = this.dotAll();
            break;

          case "\\":
            atom = this.atomEscape();
            break;

          case "[":
            atom = this.characterClass();
            break;

          case "(":
            atom = this.group();
            break;
        }

        if (atom === undefined && this.isPatternCharacter()) {
          atom = this.patternCharacter();
        }

        ASSERT_EXISTS(atom);

        if (this.isQuantifier()) {
          atom.quantifier = this.quantifier();
        }

        return atom;
      }

      dotAll() {
        this.consumeChar(".");
        return {
          type: "Set",
          complement: true,
          value: [cc("\n"), cc("\r"), cc("\u2028"), cc("\u2029")]
        };
      }

      atomEscape() {
        this.consumeChar("\\");

        switch (this.peekChar()) {
          case "1":
          case "2":
          case "3":
          case "4":
          case "5":
          case "6":
          case "7":
          case "8":
          case "9":
            return this.decimalEscapeAtom();

          case "d":
          case "D":
          case "s":
          case "S":
          case "w":
          case "W":
            return this.characterClassEscape();

          case "f":
          case "n":
          case "r":
          case "t":
          case "v":
            return this.controlEscapeAtom();

          case "c":
            return this.controlLetterEscapeAtom();

          case "0":
            return this.nulCharacterAtom();

          case "x":
            return this.hexEscapeSequenceAtom();

          case "u":
            return this.regExpUnicodeEscapeSequenceAtom();

          default:
            return this.identityEscapeAtom();
        }
      }

      decimalEscapeAtom() {
        var value = this.positiveInteger();
        return {
          type: "GroupBackReference",
          value: value
        };
      }

      characterClassEscape() {
        var set;
        var complement = false;

        switch (this.popChar()) {
          case "d":
            set = digitsCharCodes;
            break;

          case "D":
            set = digitsCharCodes;
            complement = true;
            break;

          case "s":
            set = whitespaceCodes;
            break;

          case "S":
            set = whitespaceCodes;
            complement = true;
            break;

          case "w":
            set = wordCharCodes;
            break;

          case "W":
            set = wordCharCodes;
            complement = true;
            break;
        }

        ASSERT_EXISTS(set);
        return {
          type: "Set",
          value: set,
          complement: complement
        };
      }

      controlEscapeAtom() {
        var escapeCode;

        switch (this.popChar()) {
          case "f":
            escapeCode = cc("\f");
            break;

          case "n":
            escapeCode = cc("\n");
            break;

          case "r":
            escapeCode = cc("\r");
            break;

          case "t":
            escapeCode = cc("\t");
            break;

          case "v":
            escapeCode = cc("\v");
            break;
        }

        ASSERT_EXISTS(escapeCode);
        return {
          type: "Character",
          value: escapeCode
        };
      }

      controlLetterEscapeAtom() {
        this.consumeChar("c");
        var letter = this.popChar();

        if (/[a-zA-Z]/.test(letter) === false) {
          throw Error("Invalid ");
        }

        var letterCode = letter.toUpperCase().charCodeAt(0) - 64;
        return {
          type: "Character",
          value: letterCode
        };
      }

      nulCharacterAtom() {
        // TODO implement '[lookahead ∉ DecimalDigit]'
        // TODO: for the deprecated octal escape sequence
        this.consumeChar("0");
        return {
          type: "Character",
          value: cc("\0")
        };
      }

      hexEscapeSequenceAtom() {
        this.consumeChar("x");
        return this.parseHexDigits(2);
      }

      regExpUnicodeEscapeSequenceAtom() {
        this.consumeChar("u");
        return this.parseHexDigits(4);
      }

      identityEscapeAtom() {
        // TODO: implement "SourceCharacter but not UnicodeIDContinue"
        // // http://unicode.org/reports/tr31/#Specific_Character_Adjustments
        var escapedChar = this.popChar();
        return {
          type: "Character",
          value: cc(escapedChar)
        };
      }

      classPatternCharacterAtom() {
        switch (this.peekChar()) {
          // istanbul ignore next
          case "\n": // istanbul ignore next

          case "\r": // istanbul ignore next

          case "\u2028": // istanbul ignore next

          case "\u2029": // istanbul ignore next

          case "\\": // istanbul ignore next

          case "]":
            throw Error("TBD");

          default:
            var nextChar = this.popChar();
            return {
              type: "Character",
              value: cc(nextChar)
            };
        }
      }

      characterClass() {
        var set = [];
        var complement = false;
        this.consumeChar("[");

        if (this.peekChar(0) === "^") {
          this.consumeChar("^");
          complement = true;
        }

        while (this.isClassAtom()) {
          var from = this.classAtom();
          var isFromSingleChar = from.type === "Character";

          if (isFromSingleChar && this.isRangeDash()) {
            this.consumeChar("-");
            var to = this.classAtom();
            var isToSingleChar = to.type === "Character"; // a range can only be used when both sides are single characters

            if (isToSingleChar) {
              if (to.value < from.value) {
                throw Error("Range out of order in character class");
              }

              set.push({
                from: from.value,
                to: to.value
              });
            } else {
              // literal dash
              insertToSet(from.value, set);
              set.push(cc("-"));
              insertToSet(to.value, set);
            }
          } else {
            insertToSet(from.value, set);
          }
        }

        this.consumeChar("]");
        return {
          type: "Set",
          complement: complement,
          value: set
        };
      }

      classAtom() {
        switch (this.peekChar()) {
          // istanbul ignore next
          case "]": // istanbul ignore next

          case "\n": // istanbul ignore next

          case "\r": // istanbul ignore next

          case "\u2028": // istanbul ignore next

          case "\u2029":
            throw Error("TBD");

          case "\\":
            return this.classEscape();

          default:
            return this.classPatternCharacterAtom();
        }
      }

      classEscape() {
        this.consumeChar("\\");

        switch (this.peekChar()) {
          // Matches a backspace.
          // (Not to be confused with \b word boundary outside characterClass)
          case "b":
            this.consumeChar("b");
            return {
              type: "Character",
              value: cc("\u0008")
            };

          case "d":
          case "D":
          case "s":
          case "S":
          case "w":
          case "W":
            return this.characterClassEscape();

          case "f":
          case "n":
          case "r":
          case "t":
          case "v":
            return this.controlEscapeAtom();

          case "c":
            return this.controlLetterEscapeAtom();

          case "0":
            return this.nulCharacterAtom();

          case "x":
            return this.hexEscapeSequenceAtom();

          case "u":
            return this.regExpUnicodeEscapeSequenceAtom();

          default:
            return this.identityEscapeAtom();
        }
      }

      group() {
        var capturing = true;
        this.consumeChar("(");

        switch (this.peekChar(0)) {
          case "?":
            this.consumeChar("?");
            this.consumeChar(":");
            capturing = false;
            break;

          default:
            this.groupIdx++;
            break;
        }

        var value = this.disjunction();
        this.consumeChar(")");
        var groupAst = {
          type: "Group",
          capturing: capturing,
          value: value
        };

        if (capturing) {
          groupAst.idx = this.groupIdx;
        }

        return groupAst;
      }

      positiveInteger() {
        var number = this.popChar(); // istanbul ignore next - can't ever get here due to previous lookahead checks
        // still implementing this error checking in case this ever changes.

        if (decimalPatternNoZero.test(number) === false) {
          throw Error("Expecting a positive integer");
        }

        while (decimalPattern.test(this.peekChar(0))) {
          number += this.popChar();
        }

        return parseInt(number, 10);
      }

      integerIncludingZero() {
        var number = this.popChar();

        if (decimalPattern.test(number) === false) {
          throw Error("Expecting an integer");
        }

        while (decimalPattern.test(this.peekChar(0))) {
          number += this.popChar();
        }

        return parseInt(number, 10);
      }

      patternCharacter() {
        var nextChar = this.popChar();

        switch (nextChar) {
          // istanbul ignore next
          case "\n": // istanbul ignore next

          case "\r": // istanbul ignore next

          case "\u2028": // istanbul ignore next

          case "\u2029": // istanbul ignore next

          case "^": // istanbul ignore next

          case "$": // istanbul ignore next

          case "\\": // istanbul ignore next

          case ".": // istanbul ignore next

          case "*": // istanbul ignore next

          case "+": // istanbul ignore next

          case "?": // istanbul ignore next

          case "(": // istanbul ignore next

          case ")": // istanbul ignore next

          case "[": // istanbul ignore next

          case "|":
            // istanbul ignore next
            throw Error("TBD");

          default:
            return {
              type: "Character",
              value: cc(nextChar)
            };
        }
      }

      isRegExpFlag() {
        switch (this.peekChar(0)) {
          case "g":
          case "i":
          case "m":
          case "u":
          case "y":
            return true;

          default:
            return false;
        }
      }

      isRangeDash() {
        return this.peekChar() === "-" && this.isClassAtom(1);
      }

      isDigit() {
        return decimalPattern.test(this.peekChar(0));
      }

      isClassAtom(howMuch) {
        if (howMuch === undefined) {
          howMuch = 0;
        }

        switch (this.peekChar(howMuch)) {
          case "]":
          case "\n":
          case "\r":
          case "\u2028":
          case "\u2029":
            return false;

          default:
            return true;
        }
      }

      isTerm() {
        return this.isAtom() || this.isAssertion();
      }

      isAtom() {
        if (this.isPatternCharacter()) {
          return true;
        }

        switch (this.peekChar(0)) {
          case ".":
          case "\\": // atomEscape

          case "[": // characterClass
          // TODO: isAtom must be called before isAssertion - disambiguate

          case "(":
            // group
            return true;

          default:
            return false;
        }
      }

      isAssertion() {
        switch (this.peekChar(0)) {
          case "^":
          case "$":
            return true;
          // '\b' or '\B'

          case "\\":
            switch (this.peekChar(1)) {
              case "b":
              case "B":
                return true;

              default:
                return false;
            }

          // '(?=' or '(?!'

          case "(":
            return this.peekChar(1) === "?" && (this.peekChar(2) === "=" || this.peekChar(2) === "!");

          default:
            return false;
        }
      }

      isQuantifier() {
        var prevState = this.saveState();

        try {
          return this.quantifier();
        } catch (e) {
          return false;
        } finally {
          this.restoreState(prevState);
        }
      }

      isPatternCharacter() {
        switch (this.peekChar()) {
          case "^":
          case "$":
          case "\\":
          case ".":
          case "*":
          case "+":
          case "?":
          case "(":
          case ")":
          case "[":
          case "|":
          case "/":
          case "\n":
          case "\r":
          case "\u2028":
          case "\u2029":
            return false;

          default:
            return true;
        }
      }

      parseHexDigits(howMany) {
        var hexString = "";

        for (var i = 0; i < howMany; i++) {
          var hexChar = this.popChar();

          if (hexDigitPattern.test(hexChar) === false) {
            throw Error("Expecting a HexDecimal digits");
          }

          hexString += hexChar;
        }

        var charCode = parseInt(hexString, 16);
        return {
          type: "Character",
          value: charCode
        };
      }

      peekChar(howMuch) {
        if (howMuch === undefined) {
          howMuch = 0;
        }

        return this.input[this.idx + howMuch];
      }

      popChar() {
        var nextChar = this.peekChar(0);
        this.consumeChar();
        return nextChar;
      }

      consumeChar(char) {
        if (char !== undefined && this.input[this.idx] !== char) {
          throw Error("Expected: '" + char + "' but found: '" + this.input[this.idx] + "' at offset: " + this.idx);
        }

        if (this.idx >= this.input.length) {
          throw Error("Unexpected end of input");
        }

        this.idx++;
      }

    }

    class BaseRegExpVisitor {
      visitChildren(node) {
        for (var key in node) {
          var child = node[key];
          /* istanbul ignore else */

          if (node.hasOwnProperty(key)) {
            if (child.type !== undefined) {
              this.visit(child);
            } else if (Array.isArray(child)) {
              child.forEach(function (subChild) {
                this.visit(subChild);
              }, this);
            }
          }
        }
      }

      visit(node) {
        switch (node.type) {
          case "Pattern":
            this.visitPattern(node);
            break;

          case "Flags":
            this.visitFlags(node);
            break;

          case "Disjunction":
            this.visitDisjunction(node);
            break;

          case "Alternative":
            this.visitAlternative(node);
            break;

          case "StartAnchor":
            this.visitStartAnchor(node);
            break;

          case "EndAnchor":
            this.visitEndAnchor(node);
            break;

          case "WordBoundary":
            this.visitWordBoundary(node);
            break;

          case "NonWordBoundary":
            this.visitNonWordBoundary(node);
            break;

          case "Lookahead":
            this.visitLookahead(node);
            break;

          case "NegativeLookahead":
            this.visitNegativeLookahead(node);
            break;

          case "Character":
            this.visitCharacter(node);
            break;

          case "Set":
            this.visitSet(node);
            break;

          case "Group":
            this.visitGroup(node);
            break;

          case "GroupBackReference":
            this.visitGroupBackReference(node);
            break;

          case "Quantifier":
            this.visitQuantifier(node);
            break;
        }

        this.visitChildren(node);
      }

      visitPattern(node) {}

      visitFlags(node) {}

      visitDisjunction(node) {}

      visitAlternative(node) {} // Assertion


      visitStartAnchor(node) {}

      visitEndAnchor(node) {}

      visitWordBoundary(node) {}

      visitNonWordBoundary(node) {}

      visitLookahead(node) {}

      visitNegativeLookahead(node) {} // atoms


      visitCharacter(node) {}

      visitSet(node) {}

      visitGroup(node) {}

      visitGroupBackReference(node) {}

      visitQuantifier(node) {}

    }

    const VERSION = '0.3.5';

    exports.VERSION = VERSION;
    exports.RegExpParser = RegExpParser;
    exports.BaseRegExpVisitor = BaseRegExpVisitor;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
