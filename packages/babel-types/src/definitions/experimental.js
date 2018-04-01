// @flow
import defineType, {
  assertEach,
  assertNodeType,
  assertValueType,
  chain,
} from "./utils";
import { classMethodOrPropertyCommon } from "./es2015";

defineType("AwaitExpression", {
  builder: ["argument"],
  visitor: ["argument"],
  aliases: ["Expression", "Terminatorless"],
  fields: {
    argument: {
      validate: assertNodeType("Expression"),
    },
  },
});

defineType("BindExpression", {
  visitor: ["object", "callee"],
  aliases: ["Expression"],
  fields: {
    // todo
  },
});

defineType("ClassProperty", {
  visitor: ["key", "value", "typeAnnotation", "decorators"],
  builder: ["key", "value", "typeAnnotation", "decorators", "computed"],
  aliases: ["Property"],
  fields: {
    ...classMethodOrPropertyCommon,
    value: {
      validate: assertNodeType("Expression"),
      optional: true,
    },
    definite: {
      validate: assertValueType("boolean"),
      optional: true,
    },
    typeAnnotation: {
      validate: assertNodeType("TypeAnnotation", "TSTypeAnnotation", "Noop"),
      optional: true,
    },
    decorators: {
      validate: chain(
        assertValueType("array"),
        assertEach(assertNodeType("Decorator")),
      ),
      optional: true,
    },
    readonly: {
      validate: assertValueType("boolean"),
      optional: true,
    },
  },
});

defineType("OptionalMemberExpression", {
  builder: ["object", "property", "computed", "optional"],
  visitor: ["object", "property"],
  aliases: ["Expression"],
  fields: {
    object: {
      validate: assertNodeType("Expression"),
    },
    property: {
      validate: (function() {
        const normal = assertNodeType("Identifier");
        const computed = assertNodeType("Expression");

        return function(node, key, val) {
          const validator = node.computed ? computed : normal;
          validator(node, key, val);
        };
      })(),
    },
    computed: {
      default: false,
    },
    optional: {
      validate: assertValueType("boolean"),
    },
  },
});

defineType("OptionalCallExpression", {
  visitor: ["callee", "arguments", "typeParameters", "typeArguments"],
  builder: ["callee", "arguments", "optional"],
  aliases: ["Expression"],
  fields: {
    callee: {
      validate: assertNodeType("Expression"),
    },
    arguments: {
      validate: chain(
        assertValueType("array"),
        assertEach(
          assertNodeType("Expression", "SpreadElement", "JSXNamespacedName"),
        ),
      ),
    },
    optional: {
      validate: assertValueType("boolean"),
    },
    typeArguments: {
      validate: assertNodeType("TypeParameterInstantiation"),
      optional: true,
    },
    typeParameters: {
      validate: assertNodeType("TSTypeParameterInstantiation"),
      optional: true,
    },
  },
});

defineType("ClassPrivateProperty", {
  visitor: ["key", "value"],
  builder: ["key", "value"],
  aliases: ["Property", "Private"],
  fields: {
    key: {
      validate: assertNodeType("PrivateName"),
    },
    value: {
      validate: assertNodeType("Expression"),
      optional: true,
    },
  },
});

defineType("Import", {
  aliases: ["Expression"],
});

defineType("MatchExpression", {
  visitor: ["clauses", "expression"],
  aliases: ["Expression"],
  fields: {
    clauses: {
      validate: chain(
        assertValueType("array"),
        assertEach(assertNodeType("MatchClause")),
      ),
    },
  },
});

defineType("MatchClause", {
  visitor: ["pattern", "body", "guard", "initializer"],
  fields: {
    pattern: {
      validate: assertNodeType(
        "ObjectMatchPattern",
        "ArrayMatchPattern",
        "Identifier",
        "NullLiteral",
        "BooleanLiteral",
        "NumericLiteral",
        "StringLiteral",
        "RegExpLiteral",
      ),
    },
    body: {
      validate: assertNodeType("BlockStatement", "Expression"),
    },
  },
});

defineType("MatchGuard", {
  visitor: ["body"],
  fields: {
    body: {
      validate: assertNodeType("Expression"),
    },
  },
});

defineType("ObjectMatchPattern", {
  visitor: ["children", "restProperty"],
  fields: {
    children: {
      validate: chain(
        assertValueType("array"),
        assertEach(assertNodeType("MatchProperty")),
      ),
    },
  },
});

defineType("Decorator", {
  visitor: ["expression"],
  fields: {
    expression: {
      validate: assertNodeType("Expression"),
    },
  },
});

defineType("MatchRestProperty", {
  visitor: ["pattern"],
  fields: {
    pattern: {
      validate: assertNodeType("Identifier"),
    },
  },
});

defineType("MatchProperty", {
  visitor: ["key", "value", "computed"],
  fields: {
    computed: {
      validate: assertValueType("boolean"),
      default: false,
    },
    key: {
      validate: (function() {
        const normal = assertNodeType(
          "Identifier",
          "StringLiteral",
          "NumericLiteral",
        );
        const computed = assertNodeType("Expression");

        return function(node, key, val) {
          const validator = node.computed ? computed : normal;
          validator(node, key, val);
        };
      })(),
    },
    value: {
      validate: assertNodeType(
        "ObjectMatchPattern",
        "ArrayMatchPattern",
        "Identifier",
        "NullLiteral",
        "BooleanLiteral",
        "NumericLiteral",
        "StringLiteral",
        "RegExpLiteral",
      ),
    },
  },
});

defineType("DoExpression", {
  visitor: ["body"],
  aliases: ["Expression"],
});

defineType("ArrayMatchPattern", {
  visitor: ["children", "restElement"],
  fields: {
    body: {
      validate: assertNodeType("BlockStatement"),
    },
    children: {
      validate: assertValueType("array"),
    },
  },
});

defineType("ExportDefaultSpecifier", {
  visitor: ["exported"],
  aliases: ["ModuleSpecifier"],
  fields: {
    exported: {
      validate: assertNodeType("Identifier"),
    },
  },
});

defineType("ExportNamespaceSpecifier", {
  visitor: ["exported"],
  aliases: ["ModuleSpecifier"],
  fields: {
    exported: {
      validate: assertNodeType("Identifier"),
    },
  },
});

defineType("PrivateName", {
  visitor: ["id"],
  aliases: ["Private"],
  fields: {
    id: {
      validate: assertNodeType("Identifier"),
    },
  },
});

defineType("BigIntLiteral", {
  builder: ["value"],
  fields: {
    value: {
      validate: assertValueType("string"),
    },
  },
  aliases: ["Expression", "Pureish", "Literal", "Immutable"],
});
