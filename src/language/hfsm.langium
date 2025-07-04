grammar Hfsm

entry Model:
    (machine=Machine)?;

Machine:
    (states+=State | transitions+=Transition)+;

State:
    (initial?='initial')? 'state' name=ID (description=STRING)? '{' (machine=Machine)? '}';

Transition:
    event=ID ('/' action=ID)? '->' target=[State:QualifiedName];


QualifiedName returns string: 
    ID ('.' ID)*;

terminal ID: /[_a-zA-Z][\w_]*/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
