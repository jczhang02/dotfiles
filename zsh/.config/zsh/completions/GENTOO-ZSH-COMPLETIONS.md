# Vendored gentoo-zsh-completions

The Gentoo completions in this directory (`_portage`, `_gentoo_packages`,
`_gentoo_repos`, `_gentoo_repos_conf`, `_gentoo_arches`, `_gentoolkit`,
`_portage_utils`, `_eselect`, `_ekeyword`, `_perl-cleaner`, `_gcc-config`,
`_binutils-config`) were copied from app-shells/gentoo-zsh-completions
20260628.1 (https://github.com/gentoo/gentoo-zsh-completions) and are
maintained here instead of through Portage. `_layman`, `_g-cpan` and `_genlop`
were not kept.

## Changes from upstream

- `_gentoo_repos_conf`, `_gentoo_repos`, `_gentoo_packages`: rewritten. One
  pass over repos.conf, correct package names and sets, binary packages from
  the `Packages` index, USE flags with descriptions, enabled flags from
  `portageq`, session memoization of the slow lists.
- `_portage`: the emerge option table is generated from Portage itself (see
  below); the action selects the argument type; emaint, portageq and ebuild
  follow Portage 3.0.82; repoman is gone.
- `_portage_utils`: option lists are parsed from each applet's `--help` at
  completion time, so they follow the installed portage-utils; adds `q`,
  `qwhich` and `qtegrity`.
- `_gentoolkit`, `_perl-cleaner`, `_binutils-config`, `_ekeyword`, `_eselect`:
  options follow gentoolkit 0.8.1, perl-cleaner 2.30 and eselect 1.4.32.

## Maintenance

After a Portage upgrade, regenerate the emerge options and commit the diff:

    ./gen-emerge-options.py

It reads the option tables in Portage's `_emerge/main.py` and emerge(1) and
rewrites the block between the `BEGIN/END GENERATED` markers in `_portage`.
Atoms that start with `=`, `>=`, `<`, `~` or `^` must be escaped (`\=`, `\>=`)
or quoted in zsh anyway; the completions handle the escaped forms.

Authors: Baptiste Daroussin, David Durrleman, oberyno, Tim Harder,
Vadim A. Misbakh-Soloviov.

Distributed under the ZSH license:

The Z Shell is copyright (c) 1992-2001 Paul Falstad, Richard Coleman,
Zoltán Hidvégi, Andrew Main, Peter Stephenson, Sven Wischnowsky, and
others.  All rights reserved.  Individual authors, whether or not
specifically named, retain copyright in all changes; in what follows, they
are referred to as `the Zsh Development Group'.  This is for convenience
only and this body has no legal status.  The Z shell is distributed under
the following licence; any provisions made in individual files take
precedence.

Permission is hereby granted, without written agreement and without
licence or royalty fees, to use, copy, modify, and distribute this
software and to distribute modified versions of this software for any
purpose, provided that the above copyright notice and the following
two paragraphs appear in all copies of this software.

In no event shall the Zsh Development Group be liable to any party for
direct, indirect, special, incidental, or consequential damages arising out
of the use of this software and its documentation, even if the Zsh
Development Group have been advised of the possibility of such damage.

The Zsh Development Group specifically disclaim any warranties, including,
but not limited to, the implied warranties of merchantability and fitness
for a particular purpose.  The software provided hereunder is on an "as is"
basis, and the Zsh Development Group have no obligation to provide
maintenance, support, updates, enhancements, or modifications.
