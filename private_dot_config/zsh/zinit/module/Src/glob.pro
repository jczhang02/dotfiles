/* Generated automatically */
static void addpath _((char*s,int l));
static int statfullpath _((const char*s,struct stat*st,int l));
static void insert _((char*s,int checked));
static void scanner _((Complist q,int shortcircuit));
static Complist parsecomplist _((char*instr));
static Complist parsepat _((char*str));
static off_t qgetnum _((char**s));
static zlong qgetmodespec _((char**s));
static char*glob_exec_string _((char**sp));
static int bracechardots _((char*str,convchar_t*c1p,convchar_t*c2p));
static char*get_match_ret _((Imatchdata imd,int b,int e));
static void set_pat_start _((Patprog p,int offs));
static void set_pat_end _((Patprog p,char null_me));
#ifdef MULTIBYTE_SUPPORT
static int iincchar _((char**tp,int left));
static int igetmatch _((char**sp,Patprog p,int fl,int n,char*replstr,LinkList*repllistp));
#else
static int igetmatch _((char**sp,Patprog p,int fl,int n,char*replstr,LinkList*repllistp));
#endif /* MULTIBYTE_SUPPORT */
static void zshtokenize _((char*s,int flags));
static int qualdev _((UNUSED(char*name),struct stat*buf,off_t dv,UNUSED(char*dummy)));
static int qualnlink _((UNUSED(char*name),struct stat*buf,off_t ct,UNUSED(char*dummy)));
static int qualuid _((UNUSED(char*name),struct stat*buf,off_t uid,UNUSED(char*dummy)));
static int qualgid _((UNUSED(char*name),struct stat*buf,off_t gid,UNUSED(char*dummy)));
static int qualisdev _((UNUSED(char*name),struct stat*buf,UNUSED(off_t junk),UNUSED(char*dummy)));
static int qualisblk _((UNUSED(char*name),struct stat*buf,UNUSED(off_t junk),UNUSED(char*dummy)));
static int qualischr _((UNUSED(char*name),struct stat*buf,UNUSED(off_t junk),UNUSED(char*dummy)));
static int qualisdir _((UNUSED(char*name),struct stat*buf,UNUSED(off_t junk),UNUSED(char*dummy)));
static int qualisfifo _((UNUSED(char*name),struct stat*buf,UNUSED(off_t junk),UNUSED(char*dummy)));
static int qualislnk _((UNUSED(char*name),struct stat*buf,UNUSED(off_t junk),UNUSED(char*dummy)));
static int qualisreg _((UNUSED(char*name),struct stat*buf,UNUSED(off_t junk),UNUSED(char*dummy)));
static int qualissock _((UNUSED(char*name),struct stat*buf,UNUSED(off_t junk),UNUSED(char*dummy)));
static int qualflags _((UNUSED(char*name),struct stat*buf,off_t mod,UNUSED(char*dummy)));
static int qualmodeflags _((UNUSED(char*name),struct stat*buf,off_t mod,UNUSED(char*dummy)));
static int qualiscom _((UNUSED(char*name),struct stat*buf,UNUSED(off_t mod),UNUSED(char*dummy)));
static int qualsize _((UNUSED(char*name),struct stat*buf,off_t size,UNUSED(char*dummy)));
static int qualtime _((UNUSED(char*name),struct stat*buf,off_t days,UNUSED(char*dummy)));
static int qualsheval _((char*name,UNUSED(struct stat*buf),UNUSED(off_t days),char*str));
static int qualnonemptydir _((char*name,struct stat*buf,UNUSED(off_t days),UNUSED(char*str)));
