import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isMailReview} from './public/mail-intent.js';
test('spoken mail requests trigger read-only review',()=>{for(const phrase of ['Jarvis check my mail','Read my e mail','Check my email','Can you go through my emails?','What is in my inbox?','What’s in my inbox?','Any new mail?','Show my unread emails','Please look at my inbox'])assert.equal(isMailReview(phrase),true,phrase)});
test('ordinary discussion and negative commands do not fetch mail',()=>{for(const phrase of ['How do I check my mail?','Do not read my mail','Don’t check my emails','Tell me a joke','Explain that email','Draft an email to my friend'])assert.equal(isMailReview(phrase),false,phrase)});
