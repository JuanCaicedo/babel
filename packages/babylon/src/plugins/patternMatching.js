// @flow

import { types as tt, TokenType, keywords as keywordTypes } from "../tokenizer/types";
import type Parser from "../parser";
import * as N from "../types";
import type { Pos, Position, } from "../util/location";

export default (superClass: Class<Parser>): Class<Parser> =>
  class extends superClass {

    // ==================================
    // Overrides
    // ==================================

    // Parse call, dot, and `[]`-subscript expressions.
    // maybe a match expression

    parseExprSubscripts(refShorthandDefaultPos: ?Pos): N.Expression {
      const startPos = this.state.start;
      const startLoc = this.state.startLoc;
      const potentialArrowAt = this.state.potentialArrowAt;
      const expr = this.parseExprAtom(refShorthandDefaultPos);

      if (
        expr.type === "ArrowFunctionExpression" &&
        expr.start === potentialArrowAt
      ) {
        return expr;
      }

      if (refShorthandDefaultPos && refShorthandDefaultPos.start) {
        return expr;
      }

      let tmp = this.parseSubscripts(expr, startPos, startLoc);
      if (
        tmp.type === "CallExpression" &&
        tmp.callee.type === "Identifier" &&
        tmp.callee.name === "match" &&
        tmp.arguments.length === 1 &&
        this.match(tt.braceL)
      ) { // properbly a match expression
        this.next();
        let node = this.startNodeAt(startPos, startLoc);

        let firstClause = this.parseMatchClause();

        node.expression = tmp.arguments[0];
        node.clauses = [ firstClause ];

        while (this.match(tt.comma)) {
          this.next();

          if (this.match(tt.braceR)) {
            break;
          }

          node.clauses.push(this.parseMatchClause());
        }

        this.eat(tt.braceR);
        return this.finishNode(node, "MatchExpression");
      } else {
        return tmp;
      }
    }

    // pattern ':' expression
    parseMatchClause(): N.MatchExpressionClause {
      let node = this.startNode();

      let pattern = this.parseMatchPattern();

      if (!this.eat(tt.colon)) {
        this.unexpected(this.state.pos, tt.colon)
      }

      let value = this.parseExpression();

      node.pattern = pattern;
      node.value = value;

      return this.finishNode(node, "MatchExpressionClause");
    }

    parseMatchPattern() : N.MatchExpressionPattern | null {
      let basic = this.parseBasicMatchPattern();
      if (basic === null) {
        if (this.match(tt._else)) {
          return "else";
        } else {
          this.unexpected();
          return null;
        }
      } else {
        return basic;
      }
    }

    parseBasicMatchPattern() : N.MatchExpressionPattern | null {
      let node;

      if (this.match(tt.braceL)) {
        return this.parseObjectPattern();
      } else if (this.match(tt.bracketL)) {
        return this.parseArrayPattern();
      } else if (this.match(tt.num)) {
        return this.parseLiteral(this.state.value, "NumericLiteral");
      } else if (this.match(tt.bigint)) {
        return this.parseLiteral(this.state.value, "BigIntLiteral");
      } else if (this.match(tt._null)) {
        node = this.startNode();
        this.next();
        return this.finishNode(node, "NullLiteral");
      } else if (this.match(tt._true)) {
        return this.parseLiteral(true, "BooleanLiteral");
      } else if (this.match(tt._false)) {
        return this.parseLiteral(false, "BooleanLiteral");
      } else if (this.match(tt.name)) {
        return this.parseIdentifier(false);
      } else {
        return null;
      }
    }

    // '{' ( propertyPattern (',')* )+ '}'
    parseObjectPattern() : N.ObjectMatchPattern {
      let node = this.startNode();
      if (!this.eat(tt.braceL)) {
        this.unexpected(this.state.pos, tt.braceL)
      }

      node.children = [];
      node.restIdentifier = null;

      while (!this.match(tt.braceR)) {
        if (this.match(tt.ellipsis)) {
          this.next();
          const id = this.parseIdentifier();
          node.restIdentifier = id;

          if (!this.eat(tt.braceR)) {
            this.unexpected(this.state.pos, tt.braceR)
          }
        } else {
          let pattern = this.parseBasicMatchPattern();
          node.children.push(pattern);
        }

        // the next token must be close bracket or comma
        if (!this.match(tt.braceR)) {
          if (!this.eat(tt.comma)) {
            this.unexpected(this.state.pos, tt.comma);
          }
        }

      }

      this.eat(tt.braceR)
      return this.finishNode(node, "ObjectMatchPattern");
    }

    parseObjectPropertyPattern() : N.ObjectPropertyMatchPattern {
      let node = this.startNode();

      node.key = this.parseIdentifier();
      node.value = null

      if (this.match(tt.colon)) {
        this.next();
        node.value = this.parseMatchPattern();
      }

      return this.finishNode(node, "ObjectPropertyMatchPattern");
    }

    // '{' ( propertyPattern (',')* )+ '}'
    parseArrayPattern() : N.ArrayMatchPattern {
      let node = this.startNode();
      if (!this.eat(tt.bracketL)) {
        this.unexpected(this.state.pos, tt.braceL)
      }

      node.children = [];
      node.hasRest = false;

      while (!this.match(tt.bracketR)) {
        if (this.match(tt.ellipsis)) {
          this.next();
          node.hasRest = true;
          if (!this.eat(tt.bracketR)) {
            this.unexpected(this.state.pos, tt.braceR);
          }
          return this.finishNode(node, "ArrayMatchPattern");
        } else {
          let pattern = this.parseBasicMatchPattern();
          node.children.push(pattern);
        }

        // the next token must be close bracket or comma
        if (!this.match(tt.bracketR)) {
          if (!this.eat(tt.comma)) {
            this.unexpected(this.state.pos, tt.comma);
          }
        }
      }

      this.eat(tt.bracketR)
      return this.finishNode(node, "ArrayMatchPattern");
    }

  };
