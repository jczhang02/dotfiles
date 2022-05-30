/* Generated automatically */
static void printbuiltinnode _((HashNode hn,int printflags));
static void freebuiltinnode _((HashNode hn));
static int new_optarg _((Options ops));
static LinkNode cd_get_dest _((char*nam,char**argv,int hard,int func));
static char*cd_do_chdir _((char*cnam,char*dest,int hard));
static char*cd_try_chdir _((char*pfix,char*dest,int hard));
static void cd_new_pwd _((int func,LinkNode dir,int quiet));
static void printdirstack _((void));
static zlong fcgetcomm _((char*s));
static int fcsubs _((char**sp,struct asgment*sub));
static int fclist _((FILE*f,Options ops,zlong first,zlong last,struct asgment*subs,Patprog pprog,int is_command));
static int fcedit _((char*ename,char*fn));
static Asgment getasg _((char***argvp,LinkList assigns));
static Param typeset_single _((char*cname,char*pname,Param pm,UNUSED(int func),int on,int off,int roff,Asgment asg,Param altpm,Options ops,int joinchar));
static int check_autoload _((Shfunc shf,char*name,Options ops,int func));
static void checkjobs _((void));
static int zread _((int izle,int*readchar,long izle_timeout));
