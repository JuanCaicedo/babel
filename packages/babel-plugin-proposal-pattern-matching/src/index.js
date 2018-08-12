import syntaxPatternMatching from "@babel/plugin-syntax-pattern-matching";
import { template } from "@babel/core";

export default function({ types: t }) {
  function makeIsArrayTest(body) {
    return template.expression(`Array.isArray(BODY)`)({
      BODY: t.cloneNode(body),
    });
  }

  function makeArrayLengthTest(id, length) {
    return template.expression(`ID.length === LENGTH`)({
      ID: t.cloneNode(id),
      LENGTH: t.numericLiteral(length),
    });
  }

  function makeIsObjectTest(body) {
    return template.expression(`typeof BODY === "object"`)({
      BODY: t.cloneNode(body),
    });
  }

  function makeRestTest(id, keys) {
    id = t.cloneNode(id);
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new Error(
        "The second param must be array, and its length must bigger than zero",
      );
    }

    let tree;
    keys.forEach((existKey, index) => {
      const expr = t.binaryExpression("!==", id, t.stringLiteral(existKey));
      if (index === 0) {
        tree = expr;
      } else {
        tree = t.logicalExpression("&&", tree, expr);
      }
    });
    return tree;
  }

  function makeTest(path, id, pattern, defines, isRoot) {
    id = t.cloneNode(id);
    let arrayTest;
    let objectTest;
    let objectPropTest;
    let objPropSubTest;
    let newId;
    let key_id;

    if (pattern === "else" && isRoot) {
      return null;
    }

    switch (pattern.type) {
      case "NumericLiteral":
      case "BigIntLiteral":
      case "StringLiteral":
      case "NullLiteral":
      case "BooleanLiteral":
        return t.binaryExpression("===", t.cloneNode(id), t.cloneNode(pattern));
        break;
      case "ArrayMatchPattern":
        arrayTest = makeIsArrayTest(id);

        if (!pattern.hasRest) {
          // if no `...`
          arrayTest = t.logicalExpression(
            "&&",
            arrayTest,
            makeArrayLengthTest(id, pattern.children.length),
          );
        } else if (pattern.restIdentifier !== null) {
          const count = pattern.children.length;
          defines.push(
            template(`var REST_ID = ID.slice(COUNT);`)({
              REST_ID: t.cloneNode(pattern.restIdentifier),
              ID: t.cloneNode(id),
              COUNT: t.numericLiteral(count),
            }),
          );
        }

        pattern.children.forEach((patternNode, index) => {
          const newId = t.memberExpression(
            t.cloneNode(id) /* object */,
            t.numericLiteral(index) /* property */,
            true /* computed */,
          );
          const subTest = makeTest(path, newId, patternNode, defines, false);

          arrayTest = t.logicalExpression("&&", arrayTest, subTest);
        });

        return arrayTest;
      case "ObjectMatchPattern":
        objectTest = makeIsObjectTest(id);

        pattern.children.forEach(propPattern => {
          const subPropTest = makeTest(path, id, propPattern, defines, false);

          objectTest = t.logicalExpression("&&", objectTest, subPropTest);
        });

        if (pattern.restIdentifier !== null) {
          const exists_key = pattern.children.map(
            propPattern => propPattern.key.name,
          );

          // make a new object
          // iterate the matched key
          // check if the matched key in the old objects
          // if it's not, add it to the new object
          //
          // let $restID = {};
          //
          // for (let $key in id) {
          //  if ($key !== $key1 && $key !== $key2 && ...) {
          //    newobj[key] = id[key];
          //  }
          // }
          if (exists_key.length > 0) {
            defines.push(
              t.variableDeclaration("var", [
                t.variableDeclarator(
                  t.cloneNode(pattern.restIdentifier),
                  t.objectExpression([]),
                ),
              ]),
            );
            key_id = path.scope.generateUidIdentifier("key");

            defines.push(
              template(`
              for (var KEY_ID in ID) {
                if (REST_TEST) {
                  REST_ID[KEY_ID] = ID[KEY_ID];
                }
              }
              `)({
                KEY_ID: t.cloneNode(key_id),
                REST_TEST: makeRestTest(key_id, exists_key),
                REST_ID: t.cloneNode(pattern.restIdentifier),
                ID: t.cloneNode(id),
              }),
            );
          } else {
            // exists_key.length === 0
            defines.push(
              template(`
              var REST_ID = Object.assign({}, ID);
              `)({
                REST_ID: t.cloneNode(pattern.restIdentifier),
                ID: t.cloneNode(id),
              }),
            );
          }
        }

        return objectTest;
      case "ObjectPropertyMatchPattern":
        objectPropTest = t.callExpression(
          t.memberExpression(
            t.cloneNode(id),
            t.identifier("hasOwnProperty"),
            false,
          ),
          [t.stringLiteral(pattern.key.name)],
        );

        newId = t.memberExpression(
          t.cloneNode(id),
          t.cloneNode(pattern.key),
          false,
        );
        if (pattern.value === null) {
          pattern.value = pattern.key;
        }
        objPropSubTest = makeTest(path, newId, pattern.value, defines, false);

        objectPropTest = t.logicalExpression(
          "&&",
          objectPropTest,
          objPropSubTest,
        );

        return objectPropTest;
      case "Identifier":
        if (isRoot) {
          if (pattern.name === "Array") {
            return template.expression(`Array.isArray(ID)`)({
              ID: t.cloneNode(id),
            });
          } else {
            return template.expression(`(PATTERN[Symbol.match] &&
              PATTERN[Symbol.match](ID) !== null) ||
              (typeof PATTERN === "function" && ID instanceof PATTERN)`)({
              PATTERN: t.cloneNode(pattern),
              ID: t.cloneNode(id),
            });
          }
        } else {
          defines.push(
            t.variableDeclaration("const", [
              t.variableDeclarator(t.cloneNode(pattern), t.cloneNode(id)),
            ]),
          );
          return t.binaryExpression(
            "!==",
            id,
            path.scope.buildUndefinedNode(), // undefined node
          );
        }
    }
    throw new Error("Not a correct pattern");
  }

  function makeClosure(clause, defines) {
    if (!Array.isArray(defines)) {
      throw new Error("The second param of makeClosure must be an array");
    }
    let body;
    if (clause.expression) {
      body = t.blockStatement([...defines, t.returnStatement(clause.body)], []);
      if (defines.length === 0) {
        return t.returnStatement(clause.body);
      }
    } else {
      // a block statement
      body = t.blockStatement([...defines, ...clause.body.body], []);
    }
    return template(`
      return function(){
        BODY
      }();
      `)({
      BODY: t.cloneNode(body),
    });
  }

  return {
    inherits: syntaxPatternMatching,

    visitor: {
      MatchExpression(path) {
        let match_expression_id;
        let first_statements_group = [];

        // detect if it's necessary to create new identifier
        if (t.isIdentifier(path.node.expression)) {
          match_expression_id = path.node.expression;
        } else {
          match_expression_id = path.scope.generateUidIdentifier("match_expr");

          first_statements_group = [
            t.variableDeclaration("const", [
              t.variableDeclarator(match_expression_id, path.node.expression),
            ]),
          ];
        }

        let mainIfTree, lastTree;

        for (let i = 0; i < path.node.clauses.length; i++) {
          const clause = path.node.clauses[i];
          const index = i;

          const defines = [];
          let _test;
          let _closure;
          if (index === 0) {
            _test = makeTest(
              path,
              match_expression_id,
              clause.pattern,
              defines,
              true,
            );
            _closure = makeClosure(clause, defines);
            if (_test === null) {
              lastTree = mainIfTree = _closure;
              break;
            } else {
              lastTree = mainIfTree = t.ifStatement(_test, _closure, null);
            }
          } else {
            _test = makeTest(
              path,
              match_expression_id,
              clause.pattern,
              defines,
              true,
            );
            _closure = makeClosure(clause, defines);
            if (_test === null) {
              lastTree.alternate = _closure;
              break;
            } else {
              const newIfTree = t.ifStatement(_test, _closure, null);
              lastTree.alternate = newIfTree;
              lastTree = newIfTree;
            }
          }
        }

        if (lastTree.alternate === null) {
          lastTree.alternate = template(
            `throw new Error("No patterns are matched")`,
          )();
        }

        const bodyExpr = t.blockStatement(
          first_statements_group.concat([mainIfTree]),
        );

        path.replaceWith(
          template.expression(`function() {
            BODY
          }()`)({
            BODY: bodyExpr,
          }),
        );
      },
    },
  };
}
