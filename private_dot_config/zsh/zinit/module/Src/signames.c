/** signames.c                                 **/
/** architecture-customized signames.c for zsh **/

#define SIGCOUNT	31

#include "zsh.mdh"

/**/
#define sigmsg(sig) ((sig) <= SIGCOUNT ? sig_msg[sig] : "unknown signal")
/**/
mod_export char *sig_msg[SIGCOUNT+2] = {
	"done",
	"hangup",
	"interrupt",
	"quit",
	"illegal hardware instruction",
	"trace trap",
	"IOT instruction",
	"bus error",
	"floating point exception",
	"killed",
	"user-defined signal 1",
	"segmentation fault",
	"user-defined signal 2",
	"broken pipe",
	"alarm",
	"terminated",
	"SIGSTKFLT",
	"death of child",
	"continued",
# ifdef USE_SUSPENDED
	"suspended (signal)",
# else
	"stopped (signal)",
# endif
# ifdef USE_SUSPENDED
	"suspended",
# else
	"stopped",
# endif
# ifdef USE_SUSPENDED
	"suspended (tty input)",
# else
	"stopped (tty input)",
# endif
# ifdef USE_SUSPENDED
	"suspended (tty output)",
# else
	"stopped (tty output)",
# endif
	"urgent condition",
	"cpu limit exceeded",
	"file size limit exceeded",
	"virtual time alarm",
	"profile signal",
	"window size changed",
	"pollable event occurred",
	"power fail",
	"invalid system call",
	NULL
};

/**/
char *sigs[SIGCOUNT+4] = {
	"EXIT",
	"HUP",
	"INT",
	"QUIT",
	"ILL",
	"TRAP",
	"IOT",
	"BUS",
	"FPE",
	"KILL",
	"USR1",
	"SEGV",
	"USR2",
	"PIPE",
	"ALRM",
	"TERM",
	"STKFLT",
	"CHLD",
	"CONT",
	"STOP",
	"TSTP",
	"TTIN",
	"TTOU",
	"URG",
	"XCPU",
	"XFSZ",
	"VTALRM",
	"PROF",
	"WINCH",
	"POLL",
	"PWR",
	"SYS",
	"ZERR",
	"DEBUG",
	NULL
};
