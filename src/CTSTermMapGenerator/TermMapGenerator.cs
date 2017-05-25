using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using NCI.Services.LexEVSCTS2;
using Newtonsoft.Json.Linq;
using Common.Logging;

namespace CTSTermMapGenerator
{
    class TermMapGenerator
    {
        static ILog log = LogManager.GetLogger(typeof(TermMapGenerator));
        static NCIThesaurusTermLoader termLoader = new NCIThesaurusTermLoader("lexevscts2.nci.nih.gov");

        static void Main(string[] args)
        {
            log.Info("Map Generator Starting");

            Task mapGen = GenerateTermsMap(new string[] { "C7057" });

            mapGen.Wait();

            log.Info("Map Generator Finished");

            Console.Read();
        }

        static Task GenerateTermsMap(string[] ids)
        {
            return Task.WhenAll(ids.Select(i => FetchAndWrite(i)));
        }

        static async Task FetchAndWrite(string entityID)
        {
            ThesaurusTerm term = await termLoader.GetTerm(entityID);

            log.Info(term.ToString());


        }
    }
}
