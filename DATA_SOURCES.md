# Dictionary Data Sources and Attribution

## JMdict / EDRDG data

This application incorporates data derived from JMdict, the Japanese-
Multilingual Dictionary File, maintained by the Electronic Dictionary Research
and Development Group (EDRDG). The application imports a JSON conversion
published by `scriptin/jmdict-simplified` and stores a derived subset in
`data/dictionary.db`.

JMdict data is used under the EDRDG General Dictionary Licence Statement:

- EDRDG licence: https://www.edrdg.org/edrdg/licence.html
- JMdict project: https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project
- JSON conversion: https://github.com/scriptin/jmdict-simplified

EDRDG states that commercial use and bundling with paid software are allowed
when its licence conditions are met. The licence requires acknowledgement of
the data source, access to the relevant documentation and licence, and a
procedure for regular dictionary-data updates. This document provides the
required acknowledgement and links. The application update channel is the
procedure used to distribute dictionary-data updates.

Copyright in the JMdict source material remains with James William Breen and
the Electronic Dictionary Research and Development Group. No copyright in
JMdict-derived data is claimed by the publisher of this application.

## Translation data

JMdict translations in languages other than Japanese and English may be subject
to separate copyrights held by their individual compilers. Before distributing
a paid build containing imported Chinese definitions, the publisher must verify
the provenance, attribution requirements, and commercial redistribution terms
for those specific translations. This verification is not replaced by the
application's commercial license.

The limited Chinese definitions added by `scripts/add-chinese-common.js` are
project-authored mappings and should be reviewed separately for their source
material before release.