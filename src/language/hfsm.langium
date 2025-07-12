grammar Hfsm

entry Model:
    (machine=Machine)?;

Machine:
    (states+=State | transitions+=Transition)+;

State:
    (initial?='initial')? 'state' name=ID '{' (machine=Machine)? '}';

Transition:
    event=ID ('/' action=ID)? '->' target=[State:QualifiedName];

QualifiedName returns string:
    ID ('.' ID)*;

terminal ID: /[_a-zA-Z][\w_]*/;

hidden terminal WHITE_SPACE: /\s+/;
hidden terminal SINGLE_LINE_COMMENT: /\/\/[^\n\r]*/;
hidden terminal MULTI_LINE_COMMENT: /\/\*[\s\S]*?\*\//;
