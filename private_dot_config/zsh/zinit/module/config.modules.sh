srcdir="."
dynamic="yes"
CONFIG_MODULES="./config.modules"
echo "creating ${CONFIG_MODULES}"
userlist=" "
if test -f ${CONFIG_MODULES}; then
  userlist="`sed -e '/^#/d' -e '/auto=y/d' -e 's/ .*/ /' -e 's/^name=/ /' \
        ${CONFIG_MODULES}`"
  mv ${CONFIG_MODULES} ${CONFIG_MODULES}.old
else
  # Save testing for existence each time.
  echo > ${CONFIG_MODULES}.old
fi
(echo "# Edit this file to change the way modules are loaded."
echo "# The format is strict; do not break lines or add extra spaces."
echo "# Run \`make prep' if you change anything here after compiling"
echo "# (there is no need if you change this just after the first time"
echo "# you run \`configure')."
echo "#"
echo "# Values of \`link' are \`static', \`dynamic' or \`no' to compile the"
echo "# module into the shell, link it in at run time, or not use it at all."
echo "# In the final case, no attempt will be made to compile it."
echo "# Use \`static' or \`no' if you do not have dynamic loading."
echo "#"
echo "# Values of \`load' are \`yes' or \`no'; if yes, any builtins etc."
echo "# provided by the module will be autoloaded by the main shell"
echo "# (so long as \`link' is not set to \`no')."
echo "#"
echo "# Values of \`auto' are \`yes' or \`no'. configure sets the value to"
echo "# \`yes'.  If you set it by hand to \`no', the line will be retained"
echo "# when the file is regenerated in future."
echo "#"
echo "# Note that the \`functions' entry extends to the end of the line."
echo "# It should not be quoted; it is used verbatim to find files to install."
echo "#"
echo "# You will need to run \`config.status --recheck' if you add a new"
echo "# module."
echo "#"
echo "# You should not change the values for the pseudo-module zsh/main,"
echo "# which is the main shell (apart from the functions entry)."
case "$userlist" in
  *" zsh/main "*) grep "^name=zsh/main " ${CONFIG_MODULES}.old;;
  *) echo "name=zsh/main modfile=Src/zsh.mdd link=static auto=yes load=yes functions=Functions/Chpwd/* Functions/Exceptions/* Functions/Math/* Functions/Misc/* Functions/MIME/* Functions/Prompts/* Functions/VCS_Info/* Functions/VCS_Info/Backends/*";;
esac
case "$userlist" in
  *" zdharma_continuum/zinit "*) grep "^name=zdharma_continuum/zinit " ${CONFIG_MODULES}.old;;
  *) echo "name=zdharma_continuum/zinit modfile=Src/zdharma_continuum/zinit.mdd link=dynamic auto=yes load=no";;
esac
) >${CONFIG_MODULES}
rm -f ${CONFIG_MODULES}.old
