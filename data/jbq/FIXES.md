# JBQ data fixes

## NLT quotation answers

BrainRacer's MASTER CSV uses complete verses from [Tyndale's American English NLT API](https://api.nlt.to/Documentation) for its 95 quotation questions. The November 22, 2026 fetch used the existing Bible references and omitted section headings, verse numbers, and footnotes. Regenerate the game's data with `npm run jbq:data`. The per-level Blooket CSVs are the legacy exports.

Scripture quotations marked (NLT) are taken from the Holy Bible, New Living Translation, copyright © 1996, 2004, 2015 by Tyndale House Ministries. Used by permission. All rights reserved.

## 2016 export cleanup

Source: PDF-extracted CSVs in Downloads. Only intra-word splits / truncations were changed; wording and the intentional `Holy Spirit [Ghost]` bracket are untouched.
The per-level files (10pt/20pt/30pt) received the identical text replacements (their Q# restarts at 1 in each file: 10pt = Q1-288, 20pt = Q289-480, 30pt = Q481-576 of MASTER).

MASTER cells changed: 37

| Q# | Column | Before | After |
|---|---|---|---|
| 15 | Question | Who wrote mo re books of the Bible than any other person? | Who wrote more books of the Bible than any other person? |
| 51 | Question | Who was I saac's wife? | Who was Isaac's wife? |
| 95 | Question | Which of the Ten Commandments f orbids wrong desires? | Which of the Ten Commandments forbids wrong desires? |
| 96 | Question | In whi ch book and chapter of the Bible do we find the first record of the Ten Commandments? | In which book and chapter of the Bible do we find the first record of the Ten Commandments? |
| 100 | Question | What was the ma in purpose of the sacrifices and offerings made by the Israelites? | What was the main purpose of the sacrifices and offerings made by the Israelites? |
| 107 | Question | How did M oses disobey God when the water came from the rock at Meribah? | How did Moses disobey God when the water came from the rock at Meribah? |
| 115 | Question | How did R ahab mark her house so she would be protected when Jericho was captured? | How did Rahab mark her house so she would be protected when Jericho was captured? |
| 117 | Question | How many t imes did the Israelites march around the walls of Jericho? | How many times did the Israelites march around the walls of Jericho? |
| 156 | Question | When the people returned to Jerusalem from captivity in Babylon, who oversaw the rebuilding of the w alls of the city? | When the people returned to Jerusalem from captivity in Babylon, who oversaw the rebuilding of the walls of the city? |
| 180 | Question | Whom did God se nd to prepare the way for Jesus? | Whom did God send to prepare the way for Jesus? |
| 182 | Question | About how l ong did Jesus preach and teach before His crucifixion? | About how long did Jesus preach and teach before His crucifixion? |
| 198 | Question | What did Jesus prophesy w ould happen to the stones of the Temple? | What did Jesus prophesy would happen to the stones of the Temple? |
| 205 | Question | What did Jesus t each about material possessions? | What did Jesus teach about material possessions? |
| 214 | Question | Which ap ostle betrayed Jesus? | Which apostle betrayed Jesus? |
| 268 | Question | To what y oung pastor did Paul write two letters which are books of the Bible? | To what young pastor did Paul write two letters which are books of the Bible? |
| 286 | Question | What does "r epentance" mean? | What does "repentance" mean? |
| 294 | Wrong Answer 1 | NIV) Matthew 7:12 So in everything, do to others what you would have them do to you. | Matthew 7:12 So in everything, do to others what you would have them do to you. |
| 308 | Question | What do we mean when we say that God is omnipr esent? | What do we mean when we say that God is omnipresent? |
| 310 | Question | What do we mean when we say that God is omnis cient? | What do we mean when we say that God is omniscient? |
| 317 | Question | Quote the verse th at says Jesus is always the same. | Quote the verse that says Jesus is always the same. |
| 331 | Question | What is the meaning of the w ord "Christ"? | What is the meaning of the word "Christ"? |
| 342 | Question | What is J esus' great "I am" saying in the Book of Revelation? | What is Jesus' great "I am" saying in the Book of Revelation? |
| 357 | Question | What in structions did Paul give Christians for getting along with other people? | What instructions did Paul give Christians for getting along with other people? |
| 375 | Wrong Answer 3 | NIV) Matthew 7:12 So in everything, do to others what you would have them do to you. | Matthew 7:12 So in everything, do to others what you would have them do to you. |
| 382 | Question | According to F irst Thessalonians chapter five, when should a Christian thank God? | According to First Thessalonians chapter five, when should a Christian thank God? |
| 385 | Correct Answer | NIV) Matthew 7:12 So in everything, do to others what you would have them do to you. | Matthew 7:12 So in everything, do to others what you would have them do to you. |
| 387 | Wrong Answer 2 | NIV) Matthew 7:12 So in everything, do to others what you would have them do to you. | Matthew 7:12 So in everything, do to others what you would have them do to you. |
| 409 | Question | Quote the verse of A cts chapter two that describes the disciples of Jesus receiving the outpouring of the Holy Spirit [Ghost]. | Quote the verse of Acts chapter two that describes the disciples of Jesus receiving the outpouring of the Holy Spirit [Ghost]. |
| 424 | Wrong Answer 1 | NIV) Matthew 7:12 So in everything, do to others what you would have them do to you. | Matthew 7:12 So in everything, do to others what you would have them do to you. |
| 474 | Question | In F irst Corinthians chapter 15, what illustration does Paul use to explain the resurrection of Christians? | In First Corinthians chapter 15, what illustration does Paul use to explain the resurrection of Christians? |
| 488 | Question | What di d John say was his purpose for writing his Gospel? | What did John say was his purpose for writing his Gospel? |
| 490 | Question | What five b ooks of the Bible are called the "Pentateuch"? | What five books of the Bible are called the "Pentateuch"? |
| 500 | Question | Give f ive of Jesus' "I am" declarations from the Gospel of John. | Give five of Jesus' "I am" declarations from the Gospel of John. |
| 521 | Question | What de finition of faith is found in Hebrews 11:1? | What definition of faith is found in Hebrews 11:1? |
| 536 | Question | What is the Chr istian's first responsibility in witnessing to the lost? | What is the Christian's first responsibility in witnessing to the lost? |
| 537 | Question | What a re the two verses in Matthew chapter six which tell us where we should store up treasures and why? | What are the two verses in Matthew chapter six which tell us where we should store up treasures and why? |
| 564 | Question | What four things sh ould we do when we participate in the communion service? | What four things should we do when we participate in the communion service? |

## Row-count check

The level files contain exactly 288 / 192 / 96 data rows, matching MASTER. The earlier 289/193/97 counts came from the 2-row header block ("Blooket Import Template" title cell that spans two physical lines, plus the column-header row), which line-based counting mixes in. After fixing, every level-file question text and its correct answer agree with MASTER (0 mismatches).
