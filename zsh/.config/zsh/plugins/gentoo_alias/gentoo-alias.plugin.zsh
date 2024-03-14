# EMERGE
alias emin='doas emerge '
alias eminsl='doas emerge -K '
alias eminsr='doas emerge -G '
alias emre='doas emerge -C '
alias emsearch='emerge -s '
alias emsync='doas emerge --sync '
alias emup='doas emerge -aDuN world '
alias emclean='doas emerge --depclean '

# PORTAGEQ
alias pocolor='portageq colormap '
alias podist='portageq distdir '
alias povar='portageq envvar '
alias pomirror='portageq gentoo_mirrors'
alias poorphan='portageq --orphaned '

# GENLOP
alias genstroy='doas genlop -l '
alias geneta='doas genlop -c '
alias genweta='watch -ct -n 1 doas genlop -c '
alias geninfo='doas genlop -i '
alias genustory='doas genlop -u '
alias genstorytime='doas genlop -t '

# QLOP
alias qsummary='doas qlop -c '
alias qtime='doas qlop -t '
alias qavg='doas qlop -a '
alias qhum='doas qlop -H '
alias qmachine='doas qlop -M '
alias qmstory='doas qlop -m '
alias qustory='doas qlop -u '
alias qastory='doas qlop -U '
alias qsstory='doas qlop -s '
alias qend='doas qlop -e '
alias qrun='doas qlop -r '

# ECLEAN
alias distclean='doas eclean --deep distfiles '
alias pkgclean='doas eclean-pkg '

# EUSE
alias newuse='doas euse -E '
alias deluse='doas euse -D '

# VIM
alias make.conf='vim /etc/portage/make.conf '
alias package.mask='vim /etc/portage/package.mask '
alias package.use='vim /etc/portage/package.use '
alias repos.conf='vim /etc/portage/repos.conf '
